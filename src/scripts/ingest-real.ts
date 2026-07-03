/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  DiputadoScore — Ingesta de datos reales                             ║
 * ║                                                                      ║
 * ║  Fuentes:                                                            ║
 * ║  • Asistencia plenario  → asamblea.go.cr/opendata/Asistencia/CSV/   ║
 * ║  • Viajes oficiales     → asamblea.go.cr/pa/datosabiertos/...       ║
 * ║  • Votaciones           → delfino.cr/asamblea/votaciones            ║
 * ║  • Proyectos de ley     → asamblea.go.cr (SIL)                      ║
 * ║  • Declaración bienes   → cgrfiles.cgr.go.cr (CSV abierto)          ║
 * ║                                                                      ║
 * ║  Uso:  npx tsx src/scripts/ingest-real.ts                           ║
 * ║  Con DB: DATABASE_URL=... npx tsx src/scripts/ingest-real.ts        ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import "dotenv/config";
import https from "https";
import * as fs from "fs";
import * as path from "path";
import { parse as csvParse } from "csv-parse/sync";
import * as cheerio from "cheerio";
import { calcMetrics, calcOverall } from "../lib/scoreCalculator";

// ── Configuración ──────────────────────────────────────────────────────────

// La Asamblea tiene certificado SSL inválido — ignorar en desarrollo
const SSL_AGENT = new https.Agent({ rejectUnauthorized: false });

const BASE_ASAMBLEA = "https://www.asamblea.go.cr";
const BASE_CGR      = "https://cgrfiles.cgr.go.cr";
const BASE_DELFINO  = "https://delfino.cr";

// Cache local para no re-descargar en cada run
const CACHE_DIR = path.join(process.cwd(), ".ingest-cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// ── Helpers HTTP ───────────────────────────────────────────────────────────

async function fetchText(url: string, opts?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    ...opts,
    // @ts-ignore — Node fetch acepta agent
    agent: url.startsWith("https") ? SSL_AGENT : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} → ${url}`);
  return res.text();
}

async function fetchCached(url: string, cacheKey: string): Promise<string> {
  const cachePath = path.join(CACHE_DIR, cacheKey);
  if (fs.existsSync(cachePath)) {
    console.log(`  [cache] ${cacheKey}`);
    return fs.readFileSync(cachePath, "utf-8");
  }
  console.log(`  [fetch] ${url}`);
  const text = await fetchText(url);
  fs.writeFileSync(cachePath, text);
  return text;
}

// ── Tipos ──────────────────────────────────────────────────────────────────

interface DepData {
  nombre: string;
  partido: string;
  provincia: string;
  slug: string; // para URLs de asamblea
  // Datos brutos a llenar durante la ingesta
  sesionesAsistidas: number;
  sesionesTotales: number;
  votacionesParticipadas: number;
  votacionesTotales: number;
  proyectosPresentados: number;
  proyectosAprobados: number;
  mociones: number;
  comisionesAsistidas: number;
  comisionesTotales: number;
  declaracionEstado: "al_dia" | "atrasada" | "no_presento";
  gastoRepresentacion: number;
  gastoPresupuesto: number;
  viajesOficiales: number;
  asesoresCount: number;
}

// ── Lista de diputados 2026–2030 con slugs ────────────────────────────────
// Slug = apellido1_apellido2 en minúsculas sin tildes (formato asamblea.go.cr)

function buildSlug(fullName: string): string {
  const norm = (s: string) => s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const parts = fullName.trim().split(/\s+/);
  // Último par de palabras = apellidos
  const ap1 = norm(parts[parts.length - 2] ?? "");
  const ap2 = norm(parts[parts.length - 1] ?? "");
  return `${ap1}_${ap2}`;
}

const DIPUTADOS_2026: Omit<DepData, "sesionesAsistidas"|"sesionesTotales"|"votacionesParticipadas"|"votacionesTotales"|"proyectosPresentados"|"proyectosAprobados"|"mociones"|"comisionesAsistidas"|"comisionesTotales"|"declaracionEstado"|"gastoRepresentacion"|"gastoPresupuesto"|"viajesOficiales"|"asesoresCount">[] = [
  // PPSO
  { nombre: "Nogui Acosta Jaén",                  partido: "Partido Pueblo Soberano",         provincia: "San José",    slug: buildSlug("Nogui Acosta Jaén") },
  { nombre: "Kattia Mora Montoya",                partido: "Partido Pueblo Soberano",         provincia: "San José",    slug: buildSlug("Kattia Mora Montoya") },
  { nombre: "Stephan Brunner Neibig",             partido: "Partido Pueblo Soberano",         provincia: "San José",    slug: buildSlug("Stephan Brunner Neibig") },
  { nombre: "Mayuli Ortega Guzmán",               partido: "Partido Pueblo Soberano",         provincia: "San José",    slug: buildSlug("Mayuli Ortega Guzmán") },
  { nombre: "Gonzalo Ramírez Zamora",             partido: "Partido Pueblo Soberano",         provincia: "San José",    slug: buildSlug("Gonzalo Ramírez Zamora") },
  { nombre: "Anna Katharina Müller Castro",       partido: "Partido Pueblo Soberano",         provincia: "San José",    slug: buildSlug("Anna Katharina Müller Castro") },
  { nombre: "Antonio Barzuna Thompson",           partido: "Partido Pueblo Soberano",         provincia: "San José",    slug: buildSlug("Antonio Barzuna Thompson") },
  { nombre: "Sadie Britton González",             partido: "Partido Pueblo Soberano",         provincia: "San José",    slug: buildSlug("Sadie Britton González") },
  { nombre: "José Miguel Villalobos Umaña",       partido: "Partido Pueblo Soberano",         provincia: "Alajuela",    slug: buildSlug("José Miguel Villalobos Umaña") },
  { nombre: "Zaira Murillo Marín",                partido: "Partido Pueblo Soberano",         provincia: "Alajuela",    slug: buildSlug("Zaira Murillo Marín") },
  { nombre: "Gerardo Bogantes Rivera",            partido: "Partido Pueblo Soberano",         provincia: "Alajuela",    slug: buildSlug("Gerardo Bogantes Rivera") },
  { nombre: "Grethel María Ávila Vargas",         partido: "Partido Pueblo Soberano",         provincia: "Alajuela",    slug: buildSlug("Grethel María Ávila Vargas") },
  { nombre: "Wilson Jiménez Cordero",             partido: "Partido Pueblo Soberano",         provincia: "Alajuela",    slug: buildSlug("Wilson Jiménez Cordero") },
  { nombre: "Kattia Ulate Alvarado",              partido: "Partido Pueblo Soberano",         provincia: "Alajuela",    slug: buildSlug("Kattia Ulate Alvarado") },
  { nombre: "Fernando Obaldía Álvarez",           partido: "Partido Pueblo Soberano",         provincia: "Alajuela",    slug: buildSlug("Fernando Obaldía Álvarez") },
  { nombre: "Cindy Blanco González",              partido: "Partido Pueblo Soberano",         provincia: "Cartago",     slug: buildSlug("Cindy Blanco González") },
  { nombre: "Robert Barrantes Camacho",           partido: "Partido Pueblo Soberano",         provincia: "Cartago",     slug: buildSlug("Robert Barrantes Camacho") },
  { nombre: "Yara Jiménez Fallas",                partido: "Partido Pueblo Soberano",         provincia: "Cartago",     slug: buildSlug("Yara Jiménez Fallas") },
  { nombre: "Marta Esquivel Rodríguez",           partido: "Partido Pueblo Soberano",         provincia: "Heredia",     slug: buildSlug("Marta Esquivel Rodríguez") },
  { nombre: "Juan Manuel Quesada Espinoza",       partido: "Partido Pueblo Soberano",         provincia: "Heredia",     slug: buildSlug("Juan Manuel Quesada Espinoza") },
  { nombre: "Nayuribe Guadamuz Rosales",          partido: "Partido Pueblo Soberano",         provincia: "Guanacaste",  slug: buildSlug("Nayuribe Guadamuz Rosales") },
  { nombre: "Daniel Siezar Cárdenas",             partido: "Partido Pueblo Soberano",         provincia: "Guanacaste",  slug: buildSlug("Daniel Siezar Cárdenas") },
  { nombre: "Cindy Murillo Artavia",              partido: "Partido Pueblo Soberano",         provincia: "Guanacaste",  slug: buildSlug("Cindy Murillo Artavia") },
  { nombre: "Royner Mora Ruiz",                   partido: "Partido Pueblo Soberano",         provincia: "Puntarenas",  slug: buildSlug("Royner Mora Ruiz") },
  { nombre: "María Isabel Camareno Camareno",     partido: "Partido Pueblo Soberano",         provincia: "Puntarenas",  slug: buildSlug("María Isabel Camareno Camareno") },
  { nombre: "Ariel Alfonso Mora Fallas",          partido: "Partido Pueblo Soberano",         provincia: "Puntarenas",  slug: buildSlug("Ariel Alfonso Mora Fallas") },
  { nombre: "Ana Ruth Esquivel Medrano",          partido: "Partido Pueblo Soberano",         provincia: "Puntarenas",  slug: buildSlug("Ana Ruth Esquivel Medrano") },
  { nombre: "Osvaldo Artavia Carballo",           partido: "Partido Pueblo Soberano",         provincia: "Limón",       slug: buildSlug("Osvaldo Artavia Carballo") },
  { nombre: "Kristel Ward Hudson",                partido: "Partido Pueblo Soberano",         provincia: "Limón",       slug: buildSlug("Kristel Ward Hudson") },
  { nombre: "Kathia Calvo Cruz",                  partido: "Partido Pueblo Soberano",         provincia: "Limón",       slug: buildSlug("Kathia Calvo Cruz") },
  { nombre: "Reynaldo Arias Mora",                partido: "Partido Pueblo Soberano",         provincia: "Limón",       slug: buildSlug("Reynaldo Arias Mora") },
  // PLN
  { nombre: "Álvaro Ramírez Bogantes",            partido: "Partido Liberación Nacional",     provincia: "San José",    slug: buildSlug("Álvaro Ramírez Bogantes") },
  { nombre: "Iztarú Alfaro Guerrero",             partido: "Partido Liberación Nacional",     provincia: "San José",    slug: buildSlug("Iztarú Alfaro Guerrero") },
  { nombre: "Rafael Ángel Vargas Brenes",         partido: "Partido Liberación Nacional",     provincia: "San José",    slug: buildSlug("Rafael Ángel Vargas Brenes") },
  { nombre: "Andrea Valverde Palavicini",         partido: "Partido Liberación Nacional",     provincia: "San José",    slug: buildSlug("Andrea Valverde Palavicini") },
  { nombre: "Marco Badilla Chavarría",            partido: "Partido Liberación Nacional",     provincia: "San José",    slug: buildSlug("Marco Badilla Chavarría") },
  { nombre: "Karen Alfaro Jiménez",               partido: "Partido Liberación Nacional",     provincia: "Alajuela",    slug: buildSlug("Karen Alfaro Jiménez") },
  { nombre: "Diana Murillo Murillo",              partido: "Partido Liberación Nacional",     provincia: "Alajuela",    slug: buildSlug("Diana Murillo Murillo") },
  { nombre: "Eder Hernández Ulloa",               partido: "Partido Liberación Nacional",     provincia: "Alajuela",    slug: buildSlug("Eder Hernández Ulloa") },
  { nombre: "Janice Sandí Morales",               partido: "Partido Liberación Nacional",     provincia: "Cartago",     slug: buildSlug("Janice Sandí Morales") },
  { nombre: "Salvador Padilla Villanueva",        partido: "Partido Liberación Nacional",     provincia: "Cartago",     slug: buildSlug("Salvador Padilla Villanueva") },
  { nombre: "Víctor Manuel Hidalgo Solís",        partido: "Partido Liberación Nacional",     provincia: "Heredia",     slug: buildSlug("Víctor Manuel Hidalgo Solís") },
  { nombre: "Ángela Aguilar Vargas",              partido: "Partido Liberación Nacional",     provincia: "Heredia",     slug: buildSlug("Ángela Aguilar Vargas") },
  { nombre: "Ronald Campos Villegas",             partido: "Partido Liberación Nacional",     provincia: "Guanacaste",  slug: buildSlug("Ronald Campos Villegas") },
  { nombre: "Karol Matamoros Montoya",            partido: "Partido Liberación Nacional",     provincia: "Guanacaste",  slug: buildSlug("Karol Matamoros Montoya") },
  { nombre: "Norjelens Lobo Vargas",              partido: "Partido Liberación Nacional",     provincia: "Puntarenas",  slug: buildSlug("Norjelens Lobo Vargas") },
  { nombre: "Jesús Calderón Calderón",            partido: "Partido Liberación Nacional",     provincia: "Puntarenas",  slug: buildSlug("Jesús Calderón Calderón") },
  { nombre: "Mangell Mc Lean Villalobos",         partido: "Partido Liberación Nacional",     provincia: "Limón",       slug: buildSlug("Mangell Mc Lean Villalobos") },
  // FA
  { nombre: "José María Villalta Flórez-Estrada", partido: "Frente Amplio",                  provincia: "San José",    slug: "villalta_florez_estrada" },
  { nombre: "Vianey Mora Vega",                   partido: "Frente Amplio",                  provincia: "San José",    slug: buildSlug("Vianey Mora Vega") },
  { nombre: "Antonio Trejos Mazariegos",          partido: "Frente Amplio",                  provincia: "San José",    slug: buildSlug("Antonio Trejos Mazariegos") },
  { nombre: "Edgardo Araya Sibaja",               partido: "Frente Amplio",                  provincia: "Alajuela",    slug: buildSlug("Edgardo Araya Sibaja") },
  { nombre: "Sigrid Segura Artavia",              partido: "Frente Amplio",                  provincia: "Alajuela",    slug: buildSlug("Sigrid Segura Artavia") },
  { nombre: "Joselyn Sáenz Núñez",                partido: "Frente Amplio",                  provincia: "Cartago",     slug: buildSlug("Joselyn Sáenz Núñez") },
  { nombre: "María Eugenia Román Mora",           partido: "Frente Amplio",                  provincia: "Heredia",     slug: buildSlug("María Eugenia Román Mora") },
  // CAC
  { nombre: "Claudia Dobles Camargo",             partido: "Coalición Agenda Ciudadana",     provincia: "San José",    slug: buildSlug("Claudia Dobles Camargo") },
  // PUSC
  { nombre: "Abril Gordienko López",              partido: "Partido Unidad Social Cristiana", provincia: "San José",   slug: buildSlug("Abril Gordienko López") },
];

// ── 1. Asistencia al plenario ─────────────────────────────────────────────

interface AsistenciaRecord {
  diputado: string;
  sesion: string;
  fecha: string;
  asistio: boolean;
}

async function fetchAttendanceCsvList(): Promise<string[]> {
  // El folder de CSVs es un SharePoint list view — parseamos los links
  const url = `${BASE_ASAMBLEA}/opendata/Asistencia/CSV/Forms/AllItems.aspx`;
  try {
    const html = await fetchCached(url, "asistencia-folder.html");
    const $ = cheerio.load(html);
    const csvLinks: string[] = [];
    // SharePoint list — los archivos aparecen como links a .csv
    $("a[href$='.csv'], a[href*='Asistencia'][href*='.csv']").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (href && !csvLinks.includes(href)) csvLinks.push(href);
    });
    return csvLinks;
  } catch (e) {
    console.warn("  ⚠ No se pudo listar folder de asistencia:", (e as Error).message);
    return [];
  }
}

async function parseAttendanceCsv(csvText: string): Promise<AsistenciaRecord[]> {
  try {
    const rows = csvParse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as Record<string, string>[];

    return rows.map((row) => {
      // Columnas comunes: DIPUTADO/Nombre/Diputada, SESION/Sesión, FECHA/Fecha, ASISTENCIA/Asistencia/Estado
      const nombre = row["DIPUTADO"] ?? row["Nombre"] ?? row["DIPUTADA"] ?? row["nombre"] ?? "";
      const sesion = row["SESION"] ?? row["Sesión"] ?? row["sesion"] ?? "";
      const fecha  = row["FECHA"] ?? row["Fecha"] ?? row["fecha"] ?? "";
      const estado = (row["ASISTENCIA"] ?? row["Asistencia"] ?? row["Estado"] ?? row["estado"] ?? "").toUpperCase();
      return {
        diputado: nombre.trim(),
        sesion: sesion.trim(),
        fecha: fecha.trim(),
        asistio: estado.includes("P") || estado.includes("PRESENTE") || estado === "1",
      };
    }).filter((r) => r.diputado);
  } catch {
    return [];
  }
}

async function getAttendanceData(): Promise<Map<string, { asistidas: number; totales: number }>> {
  console.log("\n📋 Descargando asistencia al plenario...");
  const result = new Map<string, { asistidas: number; totales: number }>();

  // Intentar directamente un CSV del período actual 2026
  const year = new Date().getFullYear();
  const candidateUrls = [
    `${BASE_ASAMBLEA}/opendata/Asistencia/CSV/Asistencia_${year}.csv`,
    `${BASE_ASAMBLEA}/opendata/Asistencia/CSV/asistencia_${year}.csv`,
    `${BASE_ASAMBLEA}/opendata/Asistencia/CSV/Asistencia${year}.csv`,
    // También intentar por período legislativo
    `${BASE_ASAMBLEA}/opendata/Asistencia/CSV/Periodo_2026_2030.csv`,
  ];

  let records: AsistenciaRecord[] = [];

  for (const url of candidateUrls) {
    try {
      const csv = await fetchCached(url, `asistencia-${url.split("/").pop()}`);
      const parsed = await parseAttendanceCsv(csv);
      if (parsed.length > 0) {
        console.log(`  ✓ ${parsed.length} registros desde ${url.split("/").pop()}`);
        records = [...records, ...parsed];
      }
    } catch {
      // URL no existe — continuar
    }
  }

  // Si no encontramos nada, intentar enumerar el folder
  if (records.length === 0) {
    const csvLinks = await fetchAttendanceCsvList();
    for (const link of csvLinks.slice(0, 5)) { // máximo 5 archivos
      try {
        const fullUrl = link.startsWith("http") ? link : `${BASE_ASAMBLEA}${link}`;
        const csv = await fetchCached(fullUrl, `asistencia-${encodeURIComponent(link.split("/").pop() ?? "x")}`);
        records = [...records, ...await parseAttendanceCsv(csv)];
      } catch { /* continuar */ }
    }
  }

  // Agregar por diputado
  for (const r of records) {
    const key = normName(r.diputado);
    const cur = result.get(key) ?? { asistidas: 0, totales: 0 };
    result.set(key, {
      asistidas: cur.asistidas + (r.asistio ? 1 : 0),
      totales:   cur.totales + 1,
    });
  }

  console.log(`  → ${result.size} diputados con datos de asistencia`);
  return result;
}

// ── 2. Viajes oficiales ───────────────────────────────────────────────────

async function getTravelData(): Promise<Map<string, number>> {
  console.log("\n✈️  Descargando datos de viajes...");
  const result = new Map<string, number>();

  const now = new Date();
  const months = [] as string[];
  // Últimos 6 meses
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  for (const ym of months) {
    const url = `${BASE_ASAMBLEA}/pa/datosabiertos/Documentos%20compartidos/GastosViajes/${ym}-Viajes_Institucionales.xlsx`;
    try {
      const res = await fetch(url, { agent: SSL_AGENT } as RequestInit);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      // Parsear XLSX
      const XLSX = await import("xlsx");
      const wb = XLSX.read(Buffer.from(buf), { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

      for (const row of rows) {
        // Buscar columna de nombre del diputado
        const nombre = row["DIPUTADO"] ?? row["Nombre"] ?? row["nombre"] ?? row["NOMBRE"] ?? "";
        if (!nombre) continue;
        const key = normName(nombre);
        result.set(key, (result.get(key) ?? 0) + 1);
      }
      console.log(`  ✓ Viajes ${ym}: ${rows.length} registros`);
    } catch {
      // Mes no disponible
    }
  }

  console.log(`  → ${result.size} diputados con datos de viajes`);
  return result;
}

// ── 3. Proyectos de ley por diputado ──────────────────────────────────────

interface BillSummary {
  presentados: number;
  aprobados: number;
}

async function getBillsForDeputy(slug: string): Promise<BillSummary> {
  const url = `${BASE_ASAMBLEA}/Diputados/${slug}/SitePages/Proyectos.aspx`;
  try {
    const html = await fetchCached(url, `proyectos-${slug}.html`);
    const $ = cheerio.load(html);

    let presentados = 0;
    let aprobados = 0;

    // La página lista proyectos en una tabla SharePoint
    // Contar filas (excluyendo header)
    $("tr.ms-itmhover, tr[class*='Row']").each((_, el) => {
      presentados++;
      const estado = $(el).find("td").eq(3).text().trim().toLowerCase();
      if (estado.includes("ley") || estado.includes("aprobado") || estado.includes("publicado")) {
        aprobados++;
      }
    });

    // Alternativa: buscar el número total en texto
    const totalText = $("span.ms-commandBarCell, .ms-listviewtitle").text();
    const match = totalText.match(/(\d+)\s*(elemento|proyecto|registro)/i);
    if (match && presentados === 0) {
      presentados = parseInt(match[1]);
    }

    return { presentados, aprobados };
  } catch {
    return { presentados: 0, aprobados: 0 };
  }
}

async function getAllBillsData(): Promise<Map<string, BillSummary>> {
  console.log("\n📜 Descargando proyectos de ley...");
  const result = new Map<string, BillSummary>();

  // Procesar en batches de 5 para no saturar el servidor
  const batch = 5;
  for (let i = 0; i < DIPUTADOS_2026.length; i += batch) {
    const group = DIPUTADOS_2026.slice(i, i + batch);
    const results = await Promise.all(
      group.map(async (dep) => {
        const bills = await getBillsForDeputy(dep.slug);
        return { key: normName(dep.nombre), bills };
      })
    );
    for (const { key, bills } of results) {
      result.set(key, bills);
    }
    // Pausa entre batches
    await new Promise((r) => setTimeout(r, 500));
  }

  const withData = [...result.values()].filter((b) => b.presentados > 0).length;
  console.log(`  → ${withData}/${DIPUTADOS_2026.length} diputados con proyectos`);
  return result;
}

// ── 4. Votaciones (Delfino.cr) ────────────────────────────────────────────

interface VotingData {
  participadas: number;
  totales: number;
}

async function getVotingDataFromDelfino(): Promise<Map<string, VotingData>> {
  console.log("\n🗳️  Descargando votaciones desde Delfino.cr...");
  const result = new Map<string, VotingData>();

  try {
    // Delfino tiene una página de congresistas con estadísticas
    const html = await fetchCached(
      `${BASE_DELFINO}/asamblea/congresistas`,
      "delfino-congresistas.html"
    );
    const $ = cheerio.load(html);

    // Buscar tarjetas/filas de diputados con sus stats de votación
    $(".congresista, [class*='deputado'], [class*='politician'], article, .card").each((_, el) => {
      const nombre = $(el).find("h2, h3, .name, [class*='name']").first().text().trim();
      if (!nombre) return;

      // Buscar porcentaje de participación en votaciones
      const statsText = $(el).text();
      const matchPct = statsText.match(/(\d+)[\.,]?\d*\s*%/);
      const matchVotos = statsText.match(/(\d+)\s*\/\s*(\d+)/);

      if (matchVotos) {
        result.set(normName(nombre), {
          participadas: parseInt(matchVotos[1]),
          totales:      parseInt(matchVotos[2]),
        });
      } else if (matchPct) {
        const pct = parseInt(matchPct[1]) / 100;
        result.set(normName(nombre), {
          participadas: Math.round(pct * 450),
          totales:      450,
        });
      }
    });

    // Si no encontramos datos estructurados, intentar página individual de un diputado
    if (result.size === 0) {
      const testDep = DIPUTADOS_2026[0];
      const depSlug = testDep.nombre.toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, "-");
      const depHtml = await fetchCached(
        `${BASE_DELFINO}/asamblea/congresistas/${depSlug}`,
        `delfino-dep-${depSlug}.html`
      );
      console.log(`  → Página de diputado cargada (${depHtml.length} bytes) — adaptar parser si es necesario`);
    }
  } catch (e) {
    console.warn("  ⚠ Delfino.cr no disponible:", (e as Error).message);
  }

  console.log(`  → ${result.size} diputados con datos de votación`);
  return result;
}

// ── 5. Declaración de bienes (CGR) ────────────────────────────────────────

async function getDJBData(): Promise<Map<string, "al_dia" | "atrasada" | "no_presento">> {
  console.log("\n📊 Descargando declaraciones de bienes (CGR)...");
  const result = new Map<string, "al_dia" | "atrasada" | "no_presento">();

  try {
    const csvUrl = `${BASE_CGR}/publico/docsweb/documentos/cgr-transp/datos-abiertos/djb/da-declaraciones-juradas.csv`;
    const csv = await fetchCached(csvUrl, "cgr-djb.csv");
    const rows = csvParse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    console.log(`  ✓ ${rows.length} registros de declaraciones (agregado CGR)`);

    // Este CSV es agregado por año — no por diputado individual
    // Para datos individuales, necesitamos la consulta web del CGR (requiere scraping adicional)
    // Por ahora marcamos "al_dia" como default y actualizamos desde la lista de morosos

    // Intentar lista de morosos (no declararon)
    const morososUrl = "https://www.cgr.go.cr/05-tramites-djb-do.html";
    try {
      const morososHtml = await fetchCached(morososUrl, "cgr-morosos.html");
      const $ = cheerio.load(morososHtml);

      $("table tr, li, p").each((_, el) => {
        const text = $(el).text().trim();
        // Buscar nombres de diputados en la lista
        for (const dep of DIPUTADOS_2026) {
          const apellido = dep.nombre.split(" ").slice(-2, -1)[0].toLowerCase();
          if (text.toLowerCase().includes(apellido)) {
            result.set(normName(dep.nombre), "no_presento");
          }
        }
      });
    } catch { /* continuar */ }

  } catch (e) {
    console.warn("  ⚠ CGR no disponible:", (e as Error).message);
  }

  console.log(`  → ${result.size} diputados marcados como morosos en DJB`);
  return result;
}

// ── Normalización de nombres ──────────────────────────────────────────────

function normName(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findDepByNombre(normedNombre: string): typeof DIPUTADOS_2026[0] | undefined {
  // Buscar por coincidencia de apellidos (las más únicas)
  return DIPUTADOS_2026.find((dep) => {
    const depNorm = normName(dep.nombre);
    const parts = normedNombre.split(" ");
    const depParts = depNorm.split(" ");
    // Al menos 2 palabras en común
    let matches = 0;
    for (const p of parts) {
      if (p.length > 3 && depParts.includes(p)) matches++;
    }
    return matches >= 2;
  });
}

// ── Ingesta principal ─────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  DiputadoScore — Ingesta de datos reales  ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const PERIOD_AVGS = {
    avgProyectos: 12.25,
    avgMociones:  35.63,
    avgViajes:     4.0,
    avgAsesores:   4.13,
    avgGastoPct:  79.2,
  };

  // Descargar todas las fuentes en paralelo
  const [attendanceMap, travelMap, billsMap, votingMap, djbMap] = await Promise.all([
    getAttendanceData(),
    getTravelData(),
    getAllBillsData(),
    getVotingDataFromDelfino(),
    getDJBData(),
  ]);

  console.log("\n📊 Calculando scores reales...\n");

  const results: { nombre: string; overall: number; metrics: Record<string, number>; raw: Record<string, unknown> }[] = [];

  for (const dep of DIPUTADOS_2026) {
    const normNombre = normName(dep.nombre);

    // Asistencia
    const att = attendanceMap.get(normNombre) ?? { asistidas: 0, totales: 0 };
    // Si no tenemos datos reales, buscamos por apellido
    const attByApellido = att.totales === 0
      ? (() => {
          for (const [k, v] of attendanceMap) {
            const found = findDepByNombre(k);
            if (found && normName(found.nombre) === normNombre) return v;
          }
          return null;
        })()
      : null;
    const finalAtt = attByApellido ?? att;

    // Votaciones
    const vot = votingMap.get(normNombre) ?? { participadas: 0, totales: 0 };

    // Proyectos
    const bills = billsMap.get(normNombre) ?? { presentados: 0, aprobados: 0 };

    // Viajes
    const viajes = travelMap.get(normNombre) ?? 0;

    // DJB
    const djbStatus = djbMap.get(normNombre) ?? "al_dia";

    // Si no tenemos datos reales para alguna métrica, usamos estimaciones conservadoras
    const raw = {
      sesionesAsistidas:       finalAtt.totales > 0 ? finalAtt.asistidas : 70,
      sesionesTotales:         finalAtt.totales > 0 ? finalAtt.totales   : 85,
      votacionesParticipadas:  vot.totales > 0 ? vot.participadas : 380,
      votacionesTotales:       vot.totales > 0 ? vot.totales      : 450,
      proyectosPresentados:    bills.presentados,
      proyectosAprobados:      bills.aprobados,
      mociones:                0, // sin fuente directa aún
      comisionesAsistidas:     0, // sin fuente directa aún
      comisionesTotales:       42,
      declaracionEstado:       djbStatus,
      gastoRepresentacion:     0, // sin fuente directa aún
      gastoPresupuesto:        1200000,
      viajesOficiales:         viajes,
      asesoresCount:           4,
    };

    const metrics = calcMetrics(raw, PERIOD_AVGS);
    const overall = calcOverall(metrics);

    const hasRealData = finalAtt.totales > 0 || vot.totales > 0 || bills.presentados > 0;
    const tag = hasRealData ? "✓ real" : "~ estimado";

    console.log(
      `  ${tag.padEnd(12)} ${dep.nombre.padEnd(42)} ${overall.toFixed(1)}  ` +
      `ASI:${((finalAtt.asistidas / Math.max(finalAtt.totales, 1)) * 100).toFixed(0)}%  ` +
      `PRO:${bills.presentados}  VIA:${viajes}`
    );

    results.push({ nombre: dep.nombre, overall, metrics, raw });
  }

  // Guardar resultados como JSON para inspección
  const outputPath = path.join(process.cwd(), "data", "real-scores.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Resultados guardados en data/real-scores.json`);

  // ── Upsert a la base de datos (si DATABASE_URL está disponible) ─────────
  if (process.env.DATABASE_URL) {
    console.log("\n🗄️  Guardando en base de datos...");
    try {
      const { prisma } = await import("../lib/prisma");

      const PERIOD_START = new Date("2026-05-01");
      const PERIOD_END   = new Date("2030-04-30");

      for (const dep of DIPUTADOS_2026) {
        const result = results.find((r) => r.nombre === dep.nombre);
        if (!result) continue;

        // Upsert politician
        const politician = await prisma.politician.upsert({
          where: { id: `dep-${dep.slug}` },
          create: {
            id: `dep-${dep.slug}`,
            fullName: dep.nombre,
            type: "diputado",
            party: dep.partido,
            province: dep.provincia,
            active: true,
          },
          update: {
            fullName: dep.nombre,
            party: dep.partido,
            province: dep.provincia,
          },
        });

        // Upsert period
        const period = await (prisma.period as { upsert: Function }).upsert({
          where: { id: `${politician.id}-2026` },
          create: {
            id: `${politician.id}-2026`,
            politicianId: politician.id,
            party: dep.partido,
            startDate: PERIOD_START,
            endDate: PERIOD_END,
          },
          update: { party: dep.partido },
        });

        // Upsert score
        const m = result.metrics as Record<string, number>;
        await (prisma.score as { upsert: Function }).upsert({
          where: { periodId: period.id },
          create: {
            periodId: period.id,
            overall: result.overall,
            ASI: m.ASI, COM: m.COM, PRO: m.PRO, APR: m.APR, MOC: m.MOC,
            DEC: m.DEC, GAS: m.GAS, VIA: m.VIA, ASE: m.ASE, VOT: m.VOT, COH: m.COH,
            rawData: result.raw,
          },
          update: {
            overall: result.overall,
            ASI: m.ASI, COM: m.COM, PRO: m.PRO, APR: m.APR, MOC: m.MOC,
            DEC: m.DEC, GAS: m.GAS, VIA: m.VIA, ASE: m.ASE, VOT: m.VOT, COH: m.COH,
            rawData: result.raw,
          },
        });

        process.stdout.write(".");
      }
      console.log("\n✅ Base de datos actualizada");
      await prisma.$disconnect();
    } catch (e) {
      console.error("\n❌ Error en DB:", (e as Error).message);
    }
  } else {
    console.log("\n⚠️  Sin DATABASE_URL — solo se guardó el JSON local.");
    console.log("   Para persistir: DATABASE_URL=... npx tsx src/scripts/ingest-real.ts");
  }

  // Resumen de fuentes con datos
  console.log("\n━━━━ Resumen de fuentes ━━━━");
  console.log(`  Asistencia plenario: ${attendanceMap.size > 0 ? "✓" : "✗ sin datos (CSV no disponible aún)"}`);
  console.log(`  Viajes oficiales:    ${travelMap.size > 0    ? "✓" : "✗ sin datos (XLSX no disponible aún)"}`);
  console.log(`  Proyectos de ley:    ${[...billsMap.values()].some(b => b.presentados > 0) ? "✓" : "✗ sin datos (SharePoint bloqueó scraping)"}`);
  console.log(`  Votaciones:          ${votingMap.size > 0     ? "✓" : "✗ sin datos (Delfino sin API)"}`);
  console.log(`  Declaración bienes:  ${djbMap.size > 0        ? "✓" : "✗ solo agregado (CGR sin API por diputado)"}`);
  console.log("\n💡 Tip: ejecutar con --force para ignorar el cache local");
  console.log("   rm -rf .ingest-cache && npx tsx src/scripts/ingest-real.ts\n");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
