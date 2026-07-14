/**
 * DiputadoScore — Regenera src/scripts/certs/globalsign-chain.pem
 *
 * El servidor de la Asamblea omite el certificado intermedio en el handshake
 * TLS, así que la ingesta necesita la cadena (intermedio + raíz) fijada en un
 * PEM. Cuando la Asamblea renueve su certificado con otro emisor, este script
 * reconstruye la cadena automáticamente:
 *
 *   1. Se conecta a www.asamblea.go.cr y lee la cadena que presenta el server.
 *   2. Si falta el intermedio, lo descarga del URL "CA Issuers" (AIA) del cert.
 *   3. Busca la raíz correspondiente en el almacén de confianza de Node
 *      (tls.rootCertificates) — la raíz NUNCA se toma de la red.
 *   4. Verifica la cadena candidata con una petición real antes de escribirla.
 *
 * Uso: npm run cert:update   (después: commitear el PEM regenerado)
 */

import tls from "tls";
import https from "https";
import http from "http";
import * as fs from "fs";
import * as path from "path";
import { X509Certificate } from "crypto";

const HOST = "www.asamblea.go.cr";
const PEM_PATH = path.join(process.cwd(), "src/scripts/certs/globalsign-chain.pem");

function derToPem(der: Buffer): string {
  const b64 = der.toString("base64").match(/.{1,64}/g)!.join("\n");
  return `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`;
}

/** Cadena tal cual la presenta el servidor (sin validar) */
function getServerChain(): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: HOST, port: 443, servername: HOST, rejectUnauthorized: false, timeout: 15000 },
      () => {
        const chain: Buffer[] = [];
        let cert = socket.getPeerCertificate(true);
        const seen = new Set<string>();
        while (cert && cert.raw && !seen.has(cert.fingerprint256)) {
          seen.add(cert.fingerprint256);
          chain.push(Buffer.from(cert.raw));
          cert = cert.issuerCertificate;
        }
        socket.end();
        resolve(chain);
      },
    );
    socket.on("error", reject);
    socket.setTimeout(15000, () => {
      socket.destroy();
      reject(new Error("timeout conectando a " + HOST));
    });
  });
}

/** Descarga el certificado del emisor vía el campo AIA "CA Issuers" */
function downloadIssuer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod
      .get(url, { timeout: 15000 }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} bajando ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

/** URL "CA Issuers" del campo Authority Information Access del certificado */
function caIssuersUrl(cert: X509Certificate): string | null {
  const aia = cert.infoAccess ?? "";
  const match = aia.match(/CA Issuers - URI:(\S+)/);
  return match ? match[1] : null;
}

/** Busca en el almacén de Node la raíz cuyo subject emite a `issuerName` */
function findRootFor(issuerName: string): string | null {
  for (const pem of tls.rootCertificates) {
    try {
      const root = new X509Certificate(pem);
      if (root.subject === issuerName) return pem.trim() + "\n";
    } catch {
      // entradas no parseables del almacén se ignoran
    }
  }
  return null;
}

/** Prueba una petición real con la cadena candidata */
function verifyChain(caPem: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://${HOST}/`,
      { agent: new https.Agent({ ca: caPem, keepAlive: false }), timeout: 20000 },
      (res) => {
        res.resume();
        resolve(); // cualquier status: el handshake TLS ya validó
      },
    );
    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error("timeout verificando la cadena"));
    });
  });
}

async function main() {
  console.log(`🔐 Reconstruyendo cadena de confianza para ${HOST}\n`);

  const serverChain = await getServerChain();
  if (!serverChain.length) throw new Error("el servidor no presentó certificados");

  const leaf = new X509Certificate(serverChain[0]);
  console.log(`   Certificado del sitio: ${leaf.subject.split("\n").pop()}`);
  console.log(`   Emisor:  ${leaf.issuer.split("\n").pop()}`);
  console.log(`   Vence:   ${leaf.validTo}`);

  // Intermedios: los que presente el server (después del leaf) o vía AIA
  const intermediates: X509Certificate[] = serverChain
    .slice(1)
    .map((der) => new X509Certificate(der))
    // descartar raíces autofirmadas presentadas por el server: la raíz sale del almacén local
    .filter((c) => c.subject !== c.issuer);

  if (!intermediates.length) {
    const url = caIssuersUrl(leaf);
    if (!url) throw new Error("el server no presentó intermedios y el cert no trae AIA");
    console.log(`   Server sin intermedios — bajando emisor vía AIA: ${url}`);
    let der = await downloadIssuer(url);
    // Algunos CA sirven PEM en vez de DER
    const asText = der.toString("utf8");
    intermediates.push(
      new X509Certificate(asText.includes("BEGIN CERTIFICATE") ? asText : der),
    );
  }

  // Subir por la cadena de intermedios hasta encontrar la raíz en el almacén de Node
  let top = intermediates[intermediates.length - 1];
  let rootPem = findRootFor(top.issuer);
  while (!rootPem) {
    const url = caIssuersUrl(top);
    if (!url) break;
    console.log(`   Buscando siguiente emisor vía AIA: ${url}`);
    const der = await downloadIssuer(url);
    const asText = der.toString("utf8");
    top = new X509Certificate(asText.includes("BEGIN CERTIFICATE") ? asText : der);
    if (top.subject === top.issuer) break; // llegamos a una raíz servida por red: no confiar
    intermediates.push(top);
    rootPem = findRootFor(top.issuer);
  }
  if (!rootPem) {
    throw new Error(
      `no encontré en el almacén de Node una raíz para "${top.issuer.split("\n").pop()}" — revisar manualmente`,
    );
  }

  const rootSubject = new X509Certificate(rootPem).subject.split("\n").pop();
  console.log(`   Intermedios: ${intermediates.length} · Raíz (almacén local): ${rootSubject}`);

  const candidate =
    intermediates.map((c) => derToPem(Buffer.from(c.raw))).join("") + rootPem;

  console.log("\n   Verificando la cadena candidata con una petición real…");
  await verifyChain(candidate);
  console.log("   ✓ Handshake TLS validado");

  const header =
    `# Cadena de confianza para ${HOST} — generada por npm run cert:update\n` +
    `# Leaf vence: ${leaf.validTo} · regenerado: ${new Date().toISOString()}\n`;
  fs.writeFileSync(PEM_PATH, header + candidate);
  console.log(`\n💾 ${path.relative(process.cwd(), PEM_PATH)} actualizado — commitealo.`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message ?? err);
  process.exit(1);
});
