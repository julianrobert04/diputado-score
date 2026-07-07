/**
 * Datos mock para preview/demo — 57 diputados reales Asamblea 2026–2030
 * Fotos: https://www.asamblea.go.cr/Diputados/SiteAssets/2026-2030/
 */

import { PoliticianCard, ScoreSnapshot, LegislativeBill } from "@/types";
import { calcMetrics, calcOverall } from "./scoreCalculator";
import { RawData } from "@/types";
import realData from "../../data/real-data.json";

const PERIOD_AVGS = {
  avgProyectos: 12.25,
  avgMociones:  35.63,
  avgViajes:     4.0,
  avgAsesores:   4.13,
  avgGastoPct:  79.2,
};

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRaw(q: number, seed: number): RawData {
  const b = q / 10;
  const h = (n: number) => (((seed * 7 + n * 13) % 97) / 97);
  const v = (base: number, idx: number, range = 0.25) =>
    Math.max(0, Math.min(1, base + (h(idx) - 0.5) * range * 2));
  const dec: "al_dia" | "atrasada" | "no_presento" =
    b > 0.65 ? "al_dia" : b > 0.35 ? "atrasada" : "no_presento";
  return {
    sesionesAsistidas:       Math.round(v(b, 1, 0.3) * 85),
    sesionesTotales:         85,
    votacionesParticipadas:  Math.round(v(b, 2, 0.25) * 450),
    votacionesTotales:       450,
    proyectosPresentados:    Math.round(v(b, 3, 0.5) * 25),
    proyectosAprobados:      Math.round(v(b * b, 4, 0.3) * 8),
    mociones:                Math.round(v(b, 5, 0.5) * 70),
    comisionesAsistidas:     Math.round(v(b, 6, 0.3) * 42),
    comisionesTotales:       42,
    declaracionEstado:       dec,
    gastoRepresentacion:     Math.round((0.3 + (1 - v(b, 8, 0.3)) * 0.7) * 1200000),
    gastoPresupuesto:        1200000,
    viajesOficiales:         Math.round((1 - v(b, 9, 0.25)) * 9 + 0.5),
    asesoresCount:           Math.round((1 - v(b, 10, 0.2)) * 7 + 1),
  };
}

function makeHistoryFromQ(q: number, seed: number): number[] {
  return Array.from({ length: 7 }, (_, i) => {
    const h = (((seed * 11 + i * 17) % 89) / 89 - 0.5) * 0.6;
    return Math.max(1, Math.min(10, parseFloat((q + h).toFixed(1))));
  });
}

const BASE_PHOTO = "https://www.asamblea.go.cr/Diputados/SiteAssets/2026-2030";

/**
 * Mapa exacto de nombre → filename según el SharePoint de la Asamblea.
 * Algunos tienen typos oficiales (ej: "damargo", "mazarieros", "sols").
 */
const PHOTO_OVERRIDES: Record<string, string> = {
  // PPSO
  "Nogui Acosta Jaén":                  "ps_acosta_jaen",
  "Kattya Mora Montoya":                "ps_mora_montoya",
  "Stephan Brunner Neibig":             "ps_brunner_neibig",
  "Mayuli Ortega Guzmán":               "ps_ortega_guzman",
  "Gonzalo Ramírez Zamora":             "ps_ramirez_zamora",
  "Anna Katharina Müller Castro":       "ps_muller_castro",
  "Antonio Barzuna Thompson":           "ps_barzuna_thompson",
  "Esmeralda Britton González":             "ps_britton_gonzalez",
  "José Miguel Villalobos Umaña":       "ps_villalobos_umana",
  "Zaira Murillo Marín":                "ps_murillo_marin",
  "Gerald Bogantes Rivera":            "ps_bogantes_rivera",
  "Grethel María Ávila Vargas":         "ps_avila_vargas",
  "Wilson Jiménez Cordero":             "ps_jimenez_cordero",
  "Kattia Ulate Alvarado":              "ps_ulate_alvarado",
  "Fernando Obaldía Álvarez":           "ps_obaldia_alvarez",
  "Cindy Blanco González":              "ps_blanco_gonzalez",
  "Roberth Barrantes Camacho":           "ps_barrantes_camacho",
  "Marta Esquivel Rodríguez":           "ps_esquivel_rodriguez",
  "Juan Manuel Quesada Espinoza":       "ps_quesada_espinoza",
  "Daniel Siezar Cárdenas":             "ps_siezar_cardenas",
  "Cindy Murillo Artavia":              "ps_murillo_artavia",
  "María Isabel Camareno Camareno":     "ps_camareno_camareno",
  "Ariel Alfonso Mora Fallas":          "ps_mora_fallas",
  "Ana Ruth Esquivel Medrano":          "ps_esquivel_medrano",
  "Osvaldo Artavia Carballo":           "ps_artavia_carballo",
  "Kristel Ward Hudson":                "ps_ward_hudson",
  "Kattia Calvo Cruz":                  "ps_calvo_cruz",
  "Reynaldo Arias Mora":                "ps_arias_mora",
  // PLN
  "Álvaro Ramírez Bogantes":            "ln_ramirez_bogantes",
  "Iztarú Alfaro Guerrero":             "ln_alfaro_guerrero",
  "Rafael Ángel Vargas Brenes":         "ln_vargas_brenes",
  "Andrea Valverde Palavicini":         "ln_valverde_palavicini",
  "Marco Badilla Chavarría":            "ln_badilla_chavarria",
  "Karen Alfaro Jiménez":               "ln_alfaro_jimenez",
  "Diana Murillo Murillo":              "ln_murillo_murillo",
  "Eder Hernández Ulloa":               "ln_hernandez_ulloa",
  "Janice Sandí Morales":               "ln_sandi_morales",
  "Salvador Padilla Villanueva":        "ln_padilla_villanueva",
  "Víctor Manuel Hidalgo Solís":        "ln_hidalgo_sols",  // typo oficial
  "Ángela Aguilar Vargas":              "ln_aguilar_vargas",
  "Ronald Campos Villegas":             "ln_campos_villegas",
  "Karol Matamoros Montoya":            "ln_matamoros_montoya",
  "Norjelens Lobo Vargas":              "ln_lobo_vargas",
  "Jesús Calderón Calderón":            "ln_calderon_calderon",
  "Mangell Mc Lean Villalobos":         "ln_mclean_villalobos",
  // Frente Amplio
  "Vianey Mora Vega":                   "fa_mora_vega",
  "Antonio Trejos Mazariegos":          "fa_trejos_mazarieros", // typo oficial
  "Edgardo Araya Sibaja":               "fa_araya_sibaja",
  "Sigrid Segura Artavia":              "fa_segura_artavia",
  "María Eugenia Román Mora":           "fa_roman_mora",
  // CAC
  "Claudia Dobles Camargo":             "cac_dobles_damargo", // typo oficial
  // PUSC
  "Abril Gordienko López":              "usc_gordienko_lopez",
};

/** Construye URL de foto pública de la Asamblea Legislativa */
function photoUrl(fullName: string, _partido: string): string {
  const filename = PHOTO_OVERRIDES[fullName];
  if (filename) return `${BASE_PHOTO}/${filename}.jpg`;
  return ""; // sin foto — mostrará inicial
}

// ── Datos reales (portal de datos abiertos de la Asamblea) ──────────────

interface RealDeputy {
  asisPL: number;
  ausPL: number;
  permPL: number;
  asisCom: number;
  ausCom: number;
  permCom: number;
  viajes: number;
  asesores: number | null;
  nombreXlsx: string;
}

const REAL_DEPUTIES = realData.deputies as Record<string, RealDeputy>;

export type RealMetric = "ASI" | "COM" | "VIA" | "ASE";

export const REAL_DATA_INFO = {
  updatedAt: realData.updatedAt,
  source: realData.source,
  attendanceMonths: realData.attendanceMonths as string[],
  tripMonths: realData.tripMonths as string[],
  advisorsMonth: realData.advisorsMonth as string | null,
  deputiesCount: Object.keys(REAL_DEPUTIES).length,
};

// Promedios reales cuando existen — mantienen la escala relativa justa
const AVGS = {
  ...PERIOD_AVGS,
  avgAsesores: (realData.avgAsesores as number | null) ?? PERIOD_AVGS.avgAsesores,
};

/** Reemplaza métricas simuladas por las reales disponibles para este diputado */
function mergeRealData(id: string, raw: RawData): { raw: RawData; realMetrics: RealMetric[] } {
  const r = REAL_DEPUTIES[id];
  if (!r) return { raw, realMetrics: [] };
  const merged = { ...raw };
  const realMetrics: RealMetric[] = [];

  const totalPL = r.asisPL + r.ausPL + r.permPL;
  if (totalPL > 0) {
    merged.sesionesAsistidas = r.asisPL;
    merged.sesionesTotales = totalPL;
    realMetrics.push("ASI");
  }
  const totalCom = r.asisCom + r.ausCom + r.permCom;
  if (totalCom > 0) {
    merged.comisionesAsistidas = r.asisCom;
    merged.comisionesTotales = totalCom;
    realMetrics.push("COM");
  }
  if (REAL_DATA_INFO.tripMonths.length > 0) {
    merged.viajesOficiales = r.viajes;
    realMetrics.push("VIA");
  }
  if (r.asesores !== null) {
    merged.asesoresCount = r.asesores;
    realMetrics.push("ASE");
  }
  return { raw: merged, realMetrics };
}

/** Métricas de este diputado que vienen de datos oficiales, no simuladas */
export function getRealMetrics(id: string): RealMetric[] {
  return SEED.find((r) => r.id === id)?.realMetrics ?? [];
}

// ── Tipos ────────────────────────────────────────────────────────────────

interface SeedRow {
  id: string;
  nombre: string;
  partido: string;
  provincia: string;
  raw: RawData;
  realMetrics: RealMetric[];
  history?: number[];
  bills?: LegislativeBill[];
  photoUrl?: string;
}

// [id, nombre, partido, provincia, quality]
type DepTuple = [string, string, string, string, number];

// ── 57 Diputados reales 2026–2030 ────────────────────────────────────────
const PPSO = "Partido Pueblo Soberano";
const PLN  = "Partido Liberación Nacional";
const FA   = "Frente Amplio";
const CAC  = "Coalición Agenda Ciudadana";
const USC  = "Partido Unidad Social Cristiana";

const DIPUTADOS: DepTuple[] = [
  // ── Partido Pueblo Soberano — 31 escaños ────────────────────────────
  ["dep-nogui-acosta",        "Nogui Acosta Jaén",                  PPSO, "San José",   7.2],
  ["dep-kattia-mora",         "Kattya Mora Montoya",                PPSO, "San José",   6.5],
  ["dep-stephan-brunner",     "Stephan Brunner Neibig",             PPSO, "San José",   6.8],
  ["dep-mayuli-ortega",       "Mayuli Ortega Guzmán",               PPSO, "San José",   6.1],
  ["dep-gonzalo-ramirez",     "Gonzalo Ramírez Zamora",             PPSO, "San José",   5.9],
  ["dep-anna-muller",         "Anna Katharina Müller Castro",       PPSO, "San José",   6.3],
  ["dep-antonio-barzuna",     "Antonio Barzuna Thompson",           PPSO, "San José",   5.7],
  ["dep-sadie-britton",       "Esmeralda Britton González",             PPSO, "San José",   5.4],
  ["dep-jose-villalobos",     "José Miguel Villalobos Umaña",       PPSO, "Alajuela",   6.6],
  ["dep-zaira-murillo",       "Zaira Murillo Marín",                PPSO, "Alajuela",   6.2],
  ["dep-gerardo-bogantes",    "Gerald Bogantes Rivera",            PPSO, "Alajuela",   5.8],
  ["dep-grethel-avila",       "Grethel María Ávila Vargas",         PPSO, "Alajuela",   6.0],
  ["dep-wilson-jimenez",      "Wilson Jiménez Cordero",             PPSO, "Alajuela",   5.5],
  ["dep-kattia-ulate",        "Kattia Ulate Alvarado",              PPSO, "Alajuela",   5.9],
  ["dep-fernando-obaldia",    "Fernando Obaldía Álvarez",           PPSO, "Alajuela",   6.4],
  ["dep-cindy-blanco",        "Cindy Blanco González",              PPSO, "Cartago",    5.6],
  ["dep-robert-barrantes",    "Roberth Barrantes Camacho",           PPSO, "Cartago",    5.3],
  ["dep-yara-jimenez",        "Yara Jiménez Fallas",                PPSO, "Cartago",    5.8],
  ["dep-marta-esquivel",      "Marta Esquivel Rodríguez",           PPSO, "Heredia",    6.1],
  ["dep-juan-quesada",        "Juan Manuel Quesada Espinoza",       PPSO, "Heredia",    6.4],
  ["dep-nayuribe-guadamuz",   "Nayuribe Guadamuz Rosales",          PPSO, "Guanacaste", 5.7],
  ["dep-daniel-siezar",       "Daniel Siezar Cárdenas",             PPSO, "Guanacaste", 5.5],
  ["dep-cindy-murillo",       "Cindy Murillo Artavia",              PPSO, "Guanacaste", 5.1],
  ["dep-royner-mora",         "Royner Mora Ruiz",                   PPSO, "Puntarenas", 5.6],
  ["dep-maria-camareno",      "María Isabel Camareno Camareno",     PPSO, "Puntarenas", 5.2],
  ["dep-ariel-mora",          "Ariel Alfonso Mora Fallas",          PPSO, "Puntarenas", 5.9],
  ["dep-anaruth-esquivel",    "Ana Ruth Esquivel Medrano",          PPSO, "Puntarenas", 5.4],
  ["dep-osvaldo-artavia",     "Osvaldo Artavia Carballo",           PPSO, "Limón",      5.8],
  ["dep-kristel-ward",        "Kristel Ward Hudson",                PPSO, "Limón",      5.3],
  ["dep-kathia-calvo",        "Kattia Calvo Cruz",                  PPSO, "Limón",      5.6],
  ["dep-reynaldo-arias",      "Reynaldo Arias Mora",                PPSO, "Limón",      5.0],

  // ── Partido Liberación Nacional — 17 escaños ────────────────────────
  ["dep-alvaro-ramirez",      "Álvaro Ramírez Bogantes",            PLN,  "San José",   7.5],
  ["dep-iztaru-alfaro",       "Iztarú Alfaro Guerrero",             PLN,  "San José",   7.2],
  ["dep-rafael-vargas",       "Rafael Ángel Vargas Brenes",         PLN,  "San José",   6.9],
  ["dep-andrea-valverde",     "Andrea Valverde Palavicini",         PLN,  "San José",   6.7],
  ["dep-marco-badilla",       "Marco Badilla Chavarría",            PLN,  "San José",   6.3],
  ["dep-karen-alfaro",        "Karen Alfaro Jiménez",               PLN,  "Alajuela",   7.0],
  ["dep-diana-murillo",       "Diana Murillo Murillo",              PLN,  "Alajuela",   6.6],
  ["dep-eder-hernandez",      "Eder Hernández Ulloa",               PLN,  "Alajuela",   6.1],
  ["dep-janice-sandi",        "Janice Sandí Morales",               PLN,  "Cartago",    6.8],
  ["dep-salvador-padilla",    "Salvador Padilla Villanueva",        PLN,  "Cartago",    6.4],
  ["dep-victor-hidalgo",      "Víctor Manuel Hidalgo Solís",        PLN,  "Heredia",    7.1],
  ["dep-angela-aguilar",      "Ángela Aguilar Vargas",              PLN,  "Heredia",    6.5],
  ["dep-ronald-campos",       "Ronald Campos Villegas",             PLN,  "Guanacaste", 6.2],
  ["dep-karol-matamoros",     "Karol Matamoros Montoya",            PLN,  "Guanacaste", 5.9],
  ["dep-norjelens-lobo",      "Norjelens Lobo Vargas",              PLN,  "Puntarenas", 6.0],
  ["dep-jesus-calderon",      "Jesús Calderón Calderón",            PLN,  "Puntarenas", 5.7],
  ["dep-mangell-mclean",      "Mangell Mc Lean Villalobos",         PLN,  "Limón",      6.3],

  // ── Frente Amplio — 7 escaños ───────────────────────────────────────
  ["dep-jose-villalta",       "José María Villalta Flórez-Estrada", FA,   "San José",   8.6],
  ["dep-vianey-mora",         "Vianey Mora Vega",                   FA,   "San José",   7.8],
  ["dep-antonio-trejos",      "Antonio Trejos Mazariegos",          FA,   "San José",   7.5],
  ["dep-edgardo-araya",       "Edgardo Araya Sibaja",               FA,   "Alajuela",   7.9],
  ["dep-sigrid-segura",       "Sigrid Segura Artavia",              FA,   "Alajuela",   7.4],
  ["dep-joselyn-saenz",       "Joselyn Sáenz Núñez",                FA,   "Cartago",    7.6],
  ["dep-maria-roman",         "María Eugenia Román Mora",           FA,   "Heredia",    7.3],

  // ── Coalición Agenda Ciudadana — 1 escaño ───────────────────────────
  ["dep-claudia-dobles",      "Claudia Dobles Camargo",             CAC,  "San José",   7.8],

  // ── PUSC — 1 escaño ────────────────────────────────────────────────
  ["dep-abril-gordienko",     "Abril Gordienko López",              USC,  "San José",   6.4],
];

// ── Bills para diputados destacados ──────────────────────────────────────
const BILLS_BY_ID: Record<string, LegislativeBill[]> = {
  "dep-jose-villalta": [
    { expediente: "24.055", title: "Ley de renta básica universal para hogares en pobreza extrema", status: "en_comision", submittedAt: "2026-06-10", summary: "Transfiere ₡120.000 mensuales a hogares bajo la línea de pobreza extrema, financiado con impuesto a la renta de altos ingresos." },
    { expediente: "24.180", title: "Ley de vivienda digna para trabajadores agrícolas migrantes", status: "en_plenario", submittedAt: "2026-07-22", summary: "Estándares mínimos de habitabilidad para campamentos de trabajadores agrícolas temporales.", publicUrl: "https://www.asamblea.go.cr" },
    { expediente: "24.290", title: "Reforma a la Ley de Zonas Francas: cláusula de contenido nacional", status: "en_comision", submittedAt: "2026-09-05", summary: "Obliga a empresas en zonas francas a subcontratar al menos 25% con proveedores costarricenses." },
    { expediente: "23.940", title: "Ley de reducción de la jornada laboral a 40 horas semanales", status: "archivado", submittedAt: "2026-01-15", summary: "Proponía reducir la jornada laboral máxima de 48 a 40 horas semanales sin reducción de salario." },
  ],
  "dep-claudia-dobles": [
    { expediente: "24.101", title: "Ley de economía circular y gestión de residuos sólidos", status: "aprobado", submittedAt: "2026-06-20", approvedAt: "2027-01-15", summary: "Marco regulatorio para economía circular: diseño de productos, responsabilidad extendida del productor, metas de reciclaje.", publicUrl: "https://www.asamblea.go.cr" },
    { expediente: "24.235", title: "Ley de ciudades inteligentes y movilidad sostenible", status: "en_primer_debate", submittedAt: "2026-09-14", summary: "Regula el uso de datos urbanos, sistemas de transporte inteligente y electromovilidad en el GAM." },
    { expediente: "24.312", title: "Reforma a la Ley de Planificación Urbana: densificación en corredores de tren", status: "en_comision", submittedAt: "2026-10-18", summary: "Permite mayor densidad residencial en un radio de 500 metros de las estaciones del tren interurbano." },
  ],
  "dep-nogui-acosta": [
    { expediente: "24.070", title: "Ley de transparencia en contratación pública digital", status: "aprobado", submittedAt: "2026-05-28", approvedAt: "2026-12-10", summary: "Todos los contratos del Estado superiores a ₡5 millones deben publicarse en plataforma digital con datos abiertos.", publicUrl: "https://www.asamblea.go.cr" },
    { expediente: "24.195", title: "Ley de fortalecimiento de la CCSS: fondos para atención primaria", status: "en_comision", submittedAt: "2026-08-09", summary: "Destina el 8% del presupuesto de la CCSS a fortalecer los EBAIS en comunidades rurales." },
    { expediente: "24.280", title: "Reforma al Código Electoral: voto electrónico en elecciones municipales", status: "en_plenario", submittedAt: "2026-09-22", summary: "Piloto de voto electrónico en elecciones municipales de 2027 en 5 cantones seleccionados." },
  ],
  "dep-alvaro-ramirez": [
    { expediente: "24.088", title: "Ley de incentivos para la producción nacional de alimentos", status: "aprobado", submittedAt: "2026-06-03", approvedAt: "2026-11-28", summary: "Exoneraciones fiscales y créditos blandos del BNCR para agricultores que produzcan granos básicos para consumo interno.", publicUrl: "https://www.asamblea.go.cr" },
    { expediente: "24.220", title: "Ley de pensiones dignas para trabajadores informales", status: "en_comision", submittedAt: "2026-09-01", summary: "Crea un régimen de pensión básica para trabajadores del sector informal con más de 20 años de cotización parcial al IVM." },
  ],
  "dep-vianey-mora": [
    { expediente: "24.145", title: "Ley de paridad y alternancia en cargos electivos", status: "en_plenario", submittedAt: "2026-07-10", summary: "Refuerza la paridad de género y la alternancia en listas de partidos para todas las elecciones nacionales y municipales." },
    { expediente: "24.261", title: "Ley de cuidados: reconocimiento del trabajo doméstico no remunerado", status: "en_comision", submittedAt: "2026-08-25", summary: "Crea un sistema nacional de cuidados con centros diurnos, permisos y reconocimiento económico al trabajo de cuidado." },
  ],
  "dep-iztaru-alfaro": [
    { expediente: "24.115", title: "Ley de protección a víctimas de violencia de género: casa de acogida", status: "aprobado", submittedAt: "2026-06-18", approvedAt: "2027-02-05", summary: "Obliga a cada provincia a contar con al menos una casa de acogida financiada por el INAMU para víctimas de violencia doméstica.", publicUrl: "https://www.asamblea.go.cr" },
    { expediente: "24.244", title: "Reforma a la Ley de Pensiones Alimentarias: actualización automática", status: "en_primer_debate", submittedAt: "2026-09-09", summary: "Indexa automáticamente las pensiones alimentarias al IPC, eliminando la necesidad de ir a juicio cada año para ajustarlas." },
  ],
};

// ── Construcción del SEED ─────────────────────────────────────────────────

const SEED: SeedRow[] = DIPUTADOS.map(([id, nombre, partido, provincia, quality], idx) => {
  const { raw, realMetrics } = mergeRealData(id, makeRaw(quality, idx + 1));
  return {
    id,
    nombre,
    partido,
    provincia,
    raw,
    realMetrics,
    history: makeHistoryFromQ(quality, idx + 1),
    bills:   BILLS_BY_ID[id] ?? [],
    photoUrl: photoUrl(nombre, partido),
  };
});

// ── Snapshots ────────────────────────────────────────────────────────────

function makeSnapshots(history: number[], scoreId: string): ScoreSnapshot[] {
  const now = Date.now();
  return history.map((overall, i) => {
    const date = new Date(now - (history.length - 1 - i) * 24 * 60 * 60 * 1000);
    const prev = i > 0 ? history[i - 1] : null;
    return {
      id: `${scoreId}-snap-${i}`,
      takenAt: date.toISOString(),
      source: "seed",
      overall,
      deltaOverall: prev !== null ? Math.round((overall - prev) * 10) / 10 : null,
      metrics: { ASI: 5, COM: 5, PRO: 5, APR: 5, MOC: 5, DEC: 5, GAS: 5, VIA: 5, ASE: 5, VOT: 5, COH: 5 },
    };
  });
}

// ── Exports ──────────────────────────────────────────────────────────────

export interface PoliticianWithTrend {
  card: PoliticianCard;
  snapshots: ScoreSnapshot[];
  latestDelta: number | null;
}

export function getMockPoliticians(q = "", provincia = "", sort = "overall_desc"): PoliticianWithTrend[] {
  const periodStart = "2026-05-01T00:00:00.000Z";
  const periodEnd   = "2030-04-30T00:00:00.000Z";

  const results: PoliticianWithTrend[] = SEED
    .filter((r) => !q || r.nombre.toLowerCase().includes(q.toLowerCase()))
    .filter((r) => !provincia || r.provincia.toLowerCase().includes(provincia.toLowerCase()))
    .map((r) => {
      const metrics   = calcMetrics(r.raw, AVGS);
      const overall   = calcOverall(metrics);
      const history   = r.history ?? [overall];
      const snapshots = makeSnapshots(history, r.id);
      const latestDelta = snapshots.at(-1)?.deltaOverall ?? null;

      const card: PoliticianCard = {
        id: r.id,
        fullName: r.nombre,
        type: "diputado",
        party: r.partido,
        province: r.provincia,
        photoUrl: r.photoUrl,
        active: true,
        overall,
        metrics,
        period: { startDate: periodStart, endDate: periodEnd },
      };
      return { card, snapshots, latestDelta };
    });

  return results.sort((a, b) => {
    if (sort === "overall_asc")  return a.card.overall - b.card.overall;
    if (sort === "name_asc")     return a.card.fullName.localeCompare(b.card.fullName);
    if (sort === "name_desc")    return b.card.fullName.localeCompare(a.card.fullName);
    return b.card.overall - a.card.overall;
  });
}

export function getMockPoliticianById(id: string) {
  const row = SEED.find((r) => r.id === id);
  if (!row) return null;
  const metrics = calcMetrics(row.raw, AVGS);
  const overall = calcOverall(metrics);
  const history = row.history ?? [overall];
  const snapshots = makeSnapshots(history, row.id);
  return { row, metrics, overall, snapshots, rawData: row.raw, bills: row.bills ?? [] };
}

export function getMockBillsById(id: string): LegislativeBill[] {
  return SEED.find((r) => r.id === id)?.bills ?? [];
}
