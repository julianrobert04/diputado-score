/**
 * DiputadoScore — Ingesta del portal de datos abiertos de la Asamblea
 *
 * Fuentes (https://www.asamblea.go.cr/pa/datosabiertos/):
 *  • RegistroAsistencia/YYYY-MM-Control_asistencia.xlsx  → asistencia PL + comisiones
 *  • GastosViajes/YYYY-MM-Viajes_Institucionales.xlsx    → viajes oficiales
 *
 * Genera data/real-data.json (versionado en el repo) con métricas reales
 * por diputado desde mayo 2026 (inicio de la legislatura 2026-2030).
 *
 * Uso: npx tsx src/scripts/ingest-opendata.ts
 */

import https from "https";
import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

const SSL_AGENT = new https.Agent({ rejectUnauthorized: false });
const BASE = "https://www.asamblea.go.cr/pa/datosabiertos/Documentos%20compartidos";
const LEGISLATURE_START = { year: 2026, month: 5 };

function fetchBuffer(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    https
      .get(url, { agent: SSL_AGENT }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", () => resolve(null));
      })
      .on("error", () => resolve(null));
  });
}

function normalize(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .sort();
}

function editDistance1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// Jaccard con tolerancia a typos oficiales de la Asamblea (ej: "Chavaría")
function jaccard(a: string[], b: string[]): number {
  const sa = [...new Set(a)];
  const sb = [...new Set(b)];
  const inter = sa.filter((t) =>
    sb.some((u) => (t.length >= 5 ? editDistance1(t, u) : t === u))
  ).length;
  return inter / (sa.length + sb.length - inter);
}

/** Lee los pares [id, nombre] directamente del código fuente de mockData */
function loadDeputies(): { id: string; nombre: string; tokens: string[] }[] {
  const src = fs.readFileSync(path.join(process.cwd(), "src/lib/mockData.ts"), "utf8");
  const matches = [...src.matchAll(/\["(dep-[^"]+)",\s*"([^"]+)"/g)];
  return matches.map((m) => ({ id: m[1], nombre: m[2], tokens: normalize(m[2]) }));
}

// La Asamblea publica apellidos inconsistentes para algunos diputados
const NAME_ALIASES: Record<string, string> = {
  "saenz blanco joselyn": "dep-joselyn-saenz",
  "saenz nuñez joselyn fabiola": "dep-joselyn-saenz",
};

function matchDeputy(
  xlsxName: string,
  deputies: ReturnType<typeof loadDeputies>
): string | null {
  const aliasKey = normalize(xlsxName).sort().join(" ");
  for (const [alias, id] of Object.entries(NAME_ALIASES)) {
    if (normalize(alias).sort().join(" ") === aliasKey) return id;
  }
  const tokens = normalize(xlsxName);
  let best: { id: string; score: number } | null = null;
  for (const dep of deputies) {
    const score = jaccard(tokens, dep.tokens);
    if (!best || score > best.score) best = { id: dep.id, score };
  }
  return best && best.score >= 0.6 ? best.id : null;
}

interface Attendance {
  asisPL: number;
  ausPL: number;
  permPL: number;
  asisCom: number;
  ausCom: number;
  permCom: number;
}

function monthsSinceLegislatureStart(): { year: number; month: number; key: string }[] {
  const now = new Date();
  const out: { year: number; month: number; key: string }[] = [];
  let y = LEGISLATURE_START.year;
  let m = LEGISLATURE_START.month;
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
    out.push({ year: y, month: m, key: `${y}-${String(m).padStart(2, "0")}` });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

async function fetchAttendanceMonth(key: string): Promise<Buffer | null> {
  // La Asamblea alterna entre "asistencia" y "Asistencia" en los filenames
  for (const variant of ["Control_asistencia", "Control_Asistencia"]) {
    const buf = await fetchBuffer(`${BASE}/RegistroAsistencia/${key}-${variant}.xlsx`);
    if (buf) return buf;
  }
  return null;
}

function parseAttendance(buf: Buffer): Map<string, Attendance> {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 });
  const header = (rows[0] ?? []).map((h) => String(h ?? "").replace(/\s+/g, " ").trim());

  const nameIdx = header.findIndex((h) => /^nombre$/i.test(h));
  const col = (label: string) => header.findIndex((h) => h.toLowerCase() === label.toLowerCase());

  // Columnas de comisiones: todo Asis/Aus/Perm que no sea del Plenario (PL)
  const comCols = { asis: [] as number[], aus: [] as number[], perm: [] as number[] };
  header.forEach((h, i) => {
    const lower = h.toLowerCase();
    if (lower.endsWith(" pl")) return;
    if (lower.startsWith("asis")) comCols.asis.push(i);
    else if (lower.startsWith("aus")) comCols.aus.push(i);
    else if (lower.startsWith("perm")) comCols.perm.push(i);
  });

  const asisPLIdx = col("Asis PL");
  const ausPLIdx = col("Aus PL");
  const permPLIdx = col("Perm PL");

  const num = (row: (string | number | null)[], i: number) =>
    i >= 0 && typeof row[i] === "number" ? (row[i] as number) : 0;
  const sum = (row: (string | number | null)[], idxs: number[]) =>
    idxs.reduce((acc, i) => acc + num(row, i), 0);

  const out = new Map<string, Attendance>();
  for (const row of rows.slice(1)) {
    const name = String(row[nameIdx] ?? "").trim();
    if (!name || name.length < 5) continue;
    out.set(name, {
      asisPL: num(row, asisPLIdx),
      ausPL: num(row, ausPLIdx),
      permPL: num(row, permPLIdx),
      asisCom: sum(row, comCols.asis),
      ausCom: sum(row, comCols.aus),
      permCom: sum(row, comCols.perm),
    });
  }
  return out;
}

async function fetchTrips(key: string): Promise<Map<string, number> | null> {
  const buf = await fetchBuffer(`${BASE}/GastosViajes/${key}-Viajes_Institucionales.xlsx`);
  if (!buf) return null;
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 });
  const header = (rows[0] ?? []).map((h) => String(h ?? "").trim().toLowerCase());
  const nameIdx = header.findIndex((h) => h.startsWith("nombre"));
  const condIdx = header.findIndex((h) => h.startsWith("condici"));
  const out = new Map<string, number>();
  for (const row of rows.slice(1)) {
    const name = String(row[nameIdx] ?? "").trim();
    const cond = String(row[condIdx] ?? "").toLowerCase();
    if (!name || !cond.includes("diputad")) continue;
    out.set(name, (out.get(name) ?? 0) + 1);
  }
  return out;
}

// ─── Proyectos de ley (API GraphQL de Delfino.cr) ────────────────────────────

const DELFINO_GQL = "https://api.delfino.cr/graphql";

function postJson(url: string, body: unknown): Promise<string | null> {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          "User-Agent": "DiputadoScore/1.0",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", () => resolve(null));
      }
    );
    req.on("error", () => resolve(null));
    req.write(data);
    req.end();
  });
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
  const raw = await postJson(DELFINO_GQL, { query, variables });
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

/** Estado final aprobado (no cuenta "Aprobado en Primer Debate") */
function isApproved(status: string): boolean {
  const s = status.toLowerCase();
  if (s.includes("primer debate")) return false;
  return s.includes("aprobado") || s.includes("resellado");
}

export interface ProjectData {
  proyectos: number;
  aprobados: number;
}

/** Proyectos por primera firma de cada diputado, legislatura actual */
async function fetchProjects(
  deputies: ReturnType<typeof loadDeputies>
): Promise<{ byId: Map<string, ProjectData>; term: string } | null> {
  const termData = await gql<{ currentTerm: { id: number; name: string } }>(
    "{ currentTerm { id name } }"
  );
  if (!termData?.currentTerm) return null;
  const { id: termId, name: termName } = termData.currentTerm;

  const repsData = await gql<{ representatives: { id: number; name: string }[] }>(
    `{ representatives(term: "${termName}", active: true) { id name } }`
  );
  if (!repsData?.representatives?.length) return null;

  const byId = new Map<string, ProjectData>();
  for (const rep of repsData.representatives) {
    const depId = matchDeputy(rep.name, deputies);
    if (!depId) {
      console.log(`   proyectos: sin match para "${rep.name}"`);
      continue;
    }
    const projData = await gql<{ projects: { status: string }[] }>(
      "query($r: Int, $t: Int) { projects(representativeId: $r, termId: $t, limit: 500) { status } }",
      { r: rep.id, t: termId }
    );
    const projects = projData?.projects ?? [];
    byId.set(depId, {
      proyectos: projects.length,
      aprobados: projects.filter((p) => isApproved(p.status)).length,
    });
    await new Promise((r) => setTimeout(r, 150));
  }
  return { byId, term: termName };
}

export interface AssistanceData {
  attended: number;
  total: number;
}

/** Asistencia a sesiones del plenario o a votaciones (Delfino), legislatura actual */
async function fetchAssistance(
  deputies: ReturnType<typeof loadDeputies>,
  kind: "meetings" | "votes"
): Promise<Map<string, AssistanceData> | null> {
  const field =
    kind === "meetings" ? "representativesMeetingAssistance" : "representativesVoteAssistance";
  const from = `${LEGISLATURE_START.year}-${String(LEGISLATURE_START.month).padStart(2, "0")}-01`;
  const to = new Date().toISOString().slice(0, 10);
  const data = await gql<
    Record<string, { representative: { name: string }; sessionsAttended: number; totalEligibleSessions: number }[]>
  >(
    `query($f: String, $t: String) { ${field}(from: $f, to: $t) {
      representative { name } sessionsAttended totalEligibleSessions
    } }`,
    { f: from, t: to }
  );
  if (!data?.[field]?.length) return null;

  const byId = new Map<string, AssistanceData>();
  for (const row of data[field]) {
    const depId = matchDeputy(row.representative.name, deputies);
    if (!depId) {
      console.log(`   ${kind}: sin match para "${row.representative.name}"`);
      continue;
    }
    byId.set(depId, {
      attended: row.sessionsAttended,
      total: row.totalEligibleSessions,
    });
  }
  return byId;
}

// ─── Cobertura mediática (Google News RSS + Claude) ─────────────────────────

function fetchText(url: string, redirects = 3): Promise<string | null> {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          resolve(fetchText(next, redirects - 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", () => resolve(null));
      })
      .on("error", () => resolve(null));
  });
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&apos;/g, "'");
}

/** Nombre corto de búsqueda: "Nombre(s) Apellido1" a partir del formato xlsx
 *  "Apellido1 Apellido2 Nombre(s)" — es como los medios nombran a los diputados. */
function searchName(nombreXlsx: string, fullName: string): string {
  const t = nombreXlsx.trim().split(/\s+/);
  if (t.length >= 3) {
    const nombres = t.slice(2).join(" ");
    return `${nombres} ${t[0]}`;
  }
  return fullName;
}

/** Titulares de los últimos 30 días vía Google News RSS (edición Costa Rica) */
async function fetchHeadlines(query: string): Promise<string[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`"${query}" when:30d`)}&hl=es-419&gl=CR&ceid=CR:es-419`;
  const xml = await fetchText(url);
  if (!xml) return [];
  const items = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g)]
    .map((m) => decodeEntities(m[1].trim()))
    // "Titular - Fuente" → quitar la fuente
    .map((t) => t.replace(/\s+-\s+[^-]+$/, "").trim())
    .filter((t) => t.length > 10);
  return [...new Set(items)].slice(0, 25);
}

interface MedData {
  pos: number;
  neg: number;
  neu: number;
  total: number;
}

/** Hash estable de un titular (normalizado) para no contarlo dos veces
 *  entre corridas semanales con ventanas de búsqueda que se traslapan. */
function headlineHash(title: string): string {
  return crypto.createHash("sha1").update(normalize(title).join(" ")).digest("hex").slice(0, 12);
}

/** Clasifica titulares con Claude Haiku: P (positiva), N (negativa), X (neutra) */
async function classifyHeadlines(
  deputy: string,
  headlines: string[],
  apiKey: string
): Promise<MedData | null> {
  const body = JSON.stringify({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Clasificá cada titular de noticia según cómo retrata al diputado/a costarricense "${deputy}": P si lo deja bien (logros, propuestas bien recibidas, reconocimientos), N si lo deja mal (denuncias, escándalos, críticas, investigaciones), X si es neutro o el diputado es mencionado de pasada.\n\n${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n\nRespondé SOLO con las letras separadas por comas, ej: P,X,N,X`,
      },
    ],
  });
  const res = await new Promise<string | null>((resolve) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      },
      (r) => {
        const chunks: Buffer[] = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        r.on("error", () => resolve(null));
      }
    );
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
  if (!res) return null;
  try {
    const json = JSON.parse(res);
    const text: string = json.content?.[0]?.text ?? "";
    const labels = text.trim().split(/[,\s]+/).filter((l) => /^[PNX]$/i.test(l));
    if (!labels.length) return null;
    const pos = labels.filter((l) => l.toUpperCase() === "P").length;
    const neg = labels.filter((l) => l.toUpperCase() === "N").length;
    return { pos, neg, neu: labels.length - pos - neg, total: labels.length };
  } catch {
    return null;
  }
}

async function main() {
  console.log("📥 DiputadoScore — ingesta de datos abiertos de la Asamblea\n");
  const deputies = loadDeputies();
  console.log(`   ${deputies.length} diputados cargados de mockData.ts\n`);

  const months = monthsSinceLegislatureStart();
  const attendanceMonths: string[] = [];
  const tripMonths: string[] = [];
  const totals = new Map<
    string,
    Attendance & {
      viajes: number;
      proyectos: number | null;
      aprobados: number | null;
      sesAsis: number | null;
      sesTotal: number | null;
      votAsis: number | null;
      votTotal: number | null;
      med: MedData | null;
      medSeen: string[];
      nombreXlsx: string;
    }
  >();
  const unmatched: string[] = [];

  const existingPath = path.join(process.cwd(), "data", "real-data.json");
  const existing = fs.existsSync(existingPath)
    ? JSON.parse(fs.readFileSync(existingPath, "utf8"))
    : null;

  for (const { key } of months) {
    const buf = await fetchAttendanceMonth(key);
    if (!buf) {
      console.log(`   asistencia ${key}: no disponible aún`);
      continue;
    }
    const parsed = parseAttendance(buf);
    attendanceMonths.push(key);
    console.log(`   asistencia ${key}: ✓ ${parsed.size} diputados`);
    for (const [xlsxName, att] of parsed) {
      const id = matchDeputy(xlsxName, deputies);
      if (!id) {
        unmatched.push(`${key}: ${xlsxName}`);
        continue;
      }
      const prev = totals.get(id) ?? {
        asisPL: 0, ausPL: 0, permPL: 0, asisCom: 0, ausCom: 0, permCom: 0,
        viajes: 0, proyectos: null, aprobados: null,
        sesAsis: null, sesTotal: null, votAsis: null, votTotal: null,
        med: null, medSeen: [], nombreXlsx: xlsxName,
      };
      totals.set(id, {
        ...prev,
        asisPL: prev.asisPL + att.asisPL,
        ausPL: prev.ausPL + att.ausPL,
        permPL: prev.permPL + att.permPL,
        asisCom: prev.asisCom + att.asisCom,
        ausCom: prev.ausCom + att.ausCom,
        permCom: prev.permCom + att.permCom,
      });
    }
  }

  for (const { key } of months) {
    const trips = await fetchTrips(key);
    if (!trips) {
      console.log(`   viajes     ${key}: no disponible aún`);
      continue;
    }
    tripMonths.push(key);
    console.log(`   viajes     ${key}: ✓ ${trips.size} diputados con viajes`);
    for (const [xlsxName, count] of trips) {
      const id = matchDeputy(xlsxName, deputies);
      if (!id) {
        unmatched.push(`viajes ${key}: ${xlsxName}`);
        continue;
      }
      const prev = totals.get(id);
      if (prev) prev.viajes += count;
    }
  }

  // Proyectos de ley: API GraphQL de Delfino.cr (primera firma, legislatura actual)
  console.log("\n📜 Proyectos de ley (Delfino.cr)");
  let projectsTerm: string | null = existing?.projectsTerm ?? null;
  const projRes = await fetchProjects(deputies);
  if (projRes) {
    projectsTerm = projRes.term;
    for (const [id, data] of projRes.byId) {
      const entry = totals.get(id);
      if (entry) {
        entry.proyectos = data.proyectos;
        entry.aprobados = data.aprobados;
      }
    }
    const withProjects = [...projRes.byId.values()].filter((p) => p.proyectos > 0).length;
    console.log(`   ✓ ${projRes.byId.size} diputados (${withProjects} con proyectos) — legislatura ${projRes.term}`);
  } else {
    console.log("   ⚠ API de Delfino no disponible — se preservan los datos existentes");
    for (const [id, entry] of totals) {
      entry.proyectos = existing?.deputies?.[id]?.proyectos ?? null;
      entry.aprobados = existing?.deputies?.[id]?.aprobados ?? null;
    }
  }

  // Asistencia al plenario y a votaciones, al día (Delfino.cr)
  console.log("\n🗳  Asistencia a sesiones y votaciones (Delfino.cr)");
  const meetRes = await fetchAssistance(deputies, "meetings");
  const voteRes = await fetchAssistance(deputies, "votes");
  if (meetRes || voteRes) {
    for (const [id, entry] of totals) {
      const m = meetRes?.get(id);
      const v = voteRes?.get(id);
      entry.sesAsis = m?.attended ?? existing?.deputies?.[id]?.sesAsis ?? null;
      entry.sesTotal = m?.total ?? existing?.deputies?.[id]?.sesTotal ?? null;
      entry.votAsis = v?.attended ?? existing?.deputies?.[id]?.votAsis ?? null;
      entry.votTotal = v?.total ?? existing?.deputies?.[id]?.votTotal ?? null;
    }
    console.log(`   ✓ sesiones: ${meetRes?.size ?? 0} diputados · votaciones: ${voteRes?.size ?? 0} diputados`);
  } else {
    console.log("   ⚠ API de Delfino no disponible — se preservan los datos existentes");
    for (const [id, entry] of totals) {
      entry.sesAsis = existing?.deputies?.[id]?.sesAsis ?? null;
      entry.sesTotal = existing?.deputies?.[id]?.sesTotal ?? null;
      entry.votAsis = existing?.deputies?.[id]?.votAsis ?? null;
      entry.votTotal = existing?.deputies?.[id]?.votTotal ?? null;
    }
  }

  // Cobertura mediática: Google News últimos 30 días + clasificación con Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const dumpHeadlines = process.env.DUMP_HEADLINES === "1";
  let medUpdatedAt: string | null = existing?.medUpdatedAt ?? null;
  if (apiKey || dumpHeadlines) {
    console.log(`\n📰 Noticias (Google News) — acumuladas desde el inicio de la legislatura${apiKey ? "" : " — solo dump, sin clasificar"}`);
    const dump: Record<string, { query: string; headlines: string[] }> = {};
    for (const dep of deputies) {
      const entry = totals.get(dep.id);
      if (!entry) continue;
      const prevMed: MedData | null = existing?.deputies?.[dep.id]?.med ?? null;
      const seen = new Set<string>(existing?.deputies?.[dep.id]?.medSeen ?? []);
      const query = searchName(entry.nombreXlsx, dep.nombre);
      const headlines = await fetchHeadlines(query);
      dump[dep.id] = { query, headlines };
      // Solo clasificar titulares que no se hayan contado en corridas anteriores
      const fresh = headlines.filter((h) => !seen.has(headlineHash(h)));
      if (apiKey) {
        if (fresh.length) {
          const med = await classifyHeadlines(query, fresh, apiKey);
          if (med) {
            entry.med = {
              pos: (prevMed?.pos ?? 0) + med.pos,
              neg: (prevMed?.neg ?? 0) + med.neg,
              neu: (prevMed?.neu ?? 0) + med.neu,
              total: (prevMed?.total ?? 0) + med.total,
            };
            fresh.forEach((h) => seen.add(headlineHash(h)));
            console.log(
              `   ${query}: ${fresh.length} titulares nuevos → +${med.pos} −${med.neg} · acumulado ${entry.med.total}`
            );
          } else {
            entry.med = prevMed;
            console.log(`   ${query}: error clasificando — se conserva el acumulado`);
          }
        } else {
          entry.med = prevMed ?? { pos: 0, neg: 0, neu: 0, total: 0 };
          console.log(`   ${query}: sin titulares nuevos · acumulado ${entry.med.total}`);
        }
        entry.medSeen = [...seen];
      } else {
        console.log(`   ${query}: ${headlines.length} titulares (${fresh.length} nuevos)`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (apiKey) medUpdatedAt = new Date().toISOString();
    if (dumpHeadlines) {
      fs.writeFileSync("/tmp/headlines.json", JSON.stringify(dump, null, 2));
      console.log("   → /tmp/headlines.json");
    }
  }
  if (!apiKey) {
    console.log("\n⚠ Sin ANTHROPIC_API_KEY — se preserva la clasificación de medios existente");
    for (const [id, entry] of totals) {
      entry.med = existing?.deputies?.[id]?.med ?? entry.med ?? null;
      entry.medSeen = existing?.deputies?.[id]?.medSeen ?? entry.medSeen ?? [];
    }
  }

  if (unmatched.length) {
    console.log(`\n⚠ Nombres sin match (${unmatched.length}):`);
    unmatched.forEach((n) => console.log(`   • ${n}`));
  }

  const avg = (nums: number[]) =>
    nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  const vals = [...totals.values()];
  const avgViajes = tripMonths.length ? avg(vals.map((t) => t.viajes)) : null;
  const permRatios = vals
    .map((t) => {
      const total = t.asisPL + t.ausPL + t.permPL + t.asisCom + t.ausCom + t.permCom;
      return total > 0 ? (t.permPL + t.permCom) / total : null;
    })
    .filter((n): n is number => n !== null);
  const avgPermRatio = avg(permRatios);
  const projVals = vals
    .map((t) => t.proyectos)
    .filter((n): n is number => n !== null);
  const avgProyectos = projVals.length ? avg(projVals) : null;

  const output = {
    updatedAt: new Date().toISOString(),
    source: "https://www.asamblea.go.cr/pa/datosabiertos/",
    attendanceMonths,
    tripMonths,
    medUpdatedAt,
    projectsTerm,
    avgViajes,
    avgPermRatio,
    avgProyectos,
    deputies: Object.fromEntries(totals),
  };

  const outPath = path.join(process.cwd(), "data", "real-data.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 ${totals.size} diputados con datos reales → data/real-data.json`);
  console.log(`   Meses de asistencia: ${attendanceMonths.join(", ") || "ninguno"}`);
  console.log(`   Meses de viajes: ${tripMonths.join(", ") || "ninguno"}`);
  console.log(`   Proyectos de ley: ${projectsTerm ? `legislatura ${projectsTerm}` : "sin datos"}`);
}

main().catch((err) => {
  console.error("Error en la ingesta:", err);
  process.exit(1);
});
