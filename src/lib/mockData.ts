/**
 * Datos de los 57 diputados de la Asamblea 2026–2030.
 * Todas las métricas provienen de data/real-data.json (portal de datos abiertos
 * de la Asamblea + Google News). No hay datos simulados.
 * Fotos: https://www.asamblea.go.cr/Diputados/SiteAssets/2026-2030/
 */

import { PoliticianCard, ScoreSnapshot, ScoreMetrics, LegislativeBill, RawData } from "@/types";
import { calcMetrics, calcOverall } from "./scoreCalculator";
import realData from "../../data/real-data.json";

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
  "Esmeralda Britton González":         "ps_britton_gonzalez",
  "José Miguel Villalobos Umaña":       "ps_villalobos_umana",
  "Zaira Murillo Marín":                "ps_murillo_marin",
  "Gerald Bogantes Rivera":             "ps_bogantes_rivera",
  "Grethel María Ávila Vargas":         "ps_avila_vargas",
  "Wilson Jiménez Cordero":             "ps_jimenez_cordero",
  "Kattia Ulate Alvarado":              "ps_ulate_alvarado",
  "Fernando Obaldía Álvarez":           "ps_obaldia_alvarez",
  "Cindy Blanco González":              "ps_blanco_gonzalez",
  "Roberth Barrantes Camacho":          "ps_barrantes_camacho",
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
function photoUrl(fullName: string): string {
  const filename = PHOTO_OVERRIDES[fullName];
  if (filename) return `${BASE_PHOTO}/${filename}.jpg`;
  return ""; // sin foto — mostrará inicial
}

// ── Datos reales (portal de datos abiertos + Google News) ────────────────

interface MedData {
  pos: number;
  neg: number;
  neu: number;
  total: number;
}

interface RealDeputy {
  asisPL: number;
  ausPL: number;
  permPL: number;
  asisCom: number;
  ausCom: number;
  permCom: number;
  viajes: number;
  proyectos?: number | null;
  aprobados?: number | null;
  med: MedData | null;
  nombreXlsx: string;
}

const REAL_DEPUTIES = realData.deputies as Record<string, RealDeputy>;

export type RealMetric = keyof ScoreMetrics;

export const REAL_DATA_INFO = {
  updatedAt: realData.updatedAt,
  source: realData.source,
  attendanceMonths: realData.attendanceMonths as string[],
  tripMonths: realData.tripMonths as string[],
  medUpdatedAt: (realData as { medUpdatedAt?: string | null }).medUpdatedAt ?? null,
  projectsTerm: (realData as { projectsTerm?: string | null }).projectsTerm ?? null,
  deputiesCount: Object.keys(REAL_DEPUTIES).length,
};

const HAS_TRIPS = REAL_DATA_INFO.tripMonths.length > 0;

const AVGS = {
  avgPermRatio: (realData.avgPermRatio as number | null) ?? 0,
  avgViajes: (realData.avgViajes as number | null) ?? 0,
  avgProyectos: ((realData as { avgProyectos?: number | null }).avgProyectos) ?? 0,
};

/** RawData 100% desde fuentes oficiales */
function buildRaw(id: string): { raw: RawData; realMetrics: RealMetric[] } {
  const r = REAL_DEPUTIES[id];
  if (!r) return { raw: {}, realMetrics: [] };
  const raw: RawData = {};
  const realMetrics: RealMetric[] = [];

  const totalPL = r.asisPL + r.ausPL + r.permPL;
  if (totalPL > 0) {
    raw.sesionesAsistidas = r.asisPL;
    raw.sesionesTotales = totalPL;
    realMetrics.push("ASI");
  }
  const totalCom = r.asisCom + r.ausCom + r.permCom;
  if (totalCom > 0) {
    raw.comisionesAsistidas = r.asisCom;
    raw.comisionesTotales = totalCom;
    realMetrics.push("COM");
  }
  if (totalPL + totalCom > 0) {
    raw.permisos = r.permPL + r.permCom;
    raw.permisosTotales = totalPL + totalCom;
    realMetrics.push("PER");
  }
  if (typeof r.proyectos === "number") {
    raw.proyectosPresentados = r.proyectos;
    raw.proyectosAprobados = r.aprobados ?? 0;
    realMetrics.push("PRO", "APR");
  }
  if (r.med !== null) {
    raw.medPos = r.med.pos;
    raw.medNeg = r.med.neg;
    raw.medNeu = r.med.neu;
    realMetrics.push("MED");
  }
  if (HAS_TRIPS) {
    raw.viajesOficiales = r.viajes;
    realMetrics.push("VIA");
  }
  return { raw, realMetrics };
}

/** Métricas de este diputado que tienen datos oficiales disponibles */
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
  photoUrl?: string;
}

// [id, nombre, partido, provincia]
type DepTuple = [string, string, string, string];

// ── 57 Diputados reales 2026–2030 ────────────────────────────────────────
const PPSO = "Partido Pueblo Soberano";
const PLN  = "Partido Liberación Nacional";
const FA   = "Frente Amplio";
const CAC  = "Coalición Agenda Ciudadana";
const USC  = "Partido Unidad Social Cristiana";

const DIPUTADOS: DepTuple[] = [
  // ── Partido Pueblo Soberano — 31 escaños ────────────────────────────
  ["dep-nogui-acosta",        "Nogui Acosta Jaén",                  PPSO, "San José"],
  ["dep-kattia-mora",         "Kattya Mora Montoya",                PPSO, "San José"],
  ["dep-stephan-brunner",     "Stephan Brunner Neibig",             PPSO, "San José"],
  ["dep-mayuli-ortega",       "Mayuli Ortega Guzmán",               PPSO, "San José"],
  ["dep-gonzalo-ramirez",     "Gonzalo Ramírez Zamora",             PPSO, "San José"],
  ["dep-anna-muller",         "Anna Katharina Müller Castro",       PPSO, "San José"],
  ["dep-antonio-barzuna",     "Antonio Barzuna Thompson",           PPSO, "San José"],
  ["dep-sadie-britton",       "Esmeralda Britton González",         PPSO, "San José"],
  ["dep-jose-villalobos",     "José Miguel Villalobos Umaña",       PPSO, "Alajuela"],
  ["dep-zaira-murillo",       "Zaira Murillo Marín",                PPSO, "Alajuela"],
  ["dep-gerardo-bogantes",    "Gerald Bogantes Rivera",             PPSO, "Alajuela"],
  ["dep-grethel-avila",       "Grethel María Ávila Vargas",         PPSO, "Alajuela"],
  ["dep-wilson-jimenez",      "Wilson Jiménez Cordero",             PPSO, "Alajuela"],
  ["dep-kattia-ulate",        "Kattia Ulate Alvarado",              PPSO, "Alajuela"],
  ["dep-fernando-obaldia",    "Fernando Obaldía Álvarez",           PPSO, "Alajuela"],
  ["dep-cindy-blanco",        "Cindy Blanco González",              PPSO, "Cartago"],
  ["dep-robert-barrantes",    "Roberth Barrantes Camacho",          PPSO, "Cartago"],
  ["dep-yara-jimenez",        "Yara Jiménez Fallas",                PPSO, "Cartago"],
  ["dep-marta-esquivel",      "Marta Esquivel Rodríguez",           PPSO, "Heredia"],
  ["dep-juan-quesada",        "Juan Manuel Quesada Espinoza",       PPSO, "Heredia"],
  ["dep-nayuribe-guadamuz",   "Nayuribe Guadamuz Rosales",          PPSO, "Guanacaste"],
  ["dep-daniel-siezar",       "Daniel Siezar Cárdenas",             PPSO, "Guanacaste"],
  ["dep-cindy-murillo",       "Cindy Murillo Artavia",              PPSO, "Guanacaste"],
  ["dep-royner-mora",         "Royner Mora Ruiz",                   PPSO, "Puntarenas"],
  ["dep-maria-camareno",      "María Isabel Camareno Camareno",     PPSO, "Puntarenas"],
  ["dep-ariel-mora",          "Ariel Alfonso Mora Fallas",          PPSO, "Puntarenas"],
  ["dep-anaruth-esquivel",    "Ana Ruth Esquivel Medrano",          PPSO, "Puntarenas"],
  ["dep-osvaldo-artavia",     "Osvaldo Artavia Carballo",           PPSO, "Limón"],
  ["dep-kristel-ward",        "Kristel Ward Hudson",                PPSO, "Limón"],
  ["dep-kathia-calvo",        "Kattia Calvo Cruz",                  PPSO, "Limón"],
  ["dep-reynaldo-arias",      "Reynaldo Arias Mora",                PPSO, "Limón"],

  // ── Partido Liberación Nacional — 17 escaños ────────────────────────
  ["dep-alvaro-ramirez",      "Álvaro Ramírez Bogantes",            PLN,  "San José"],
  ["dep-iztaru-alfaro",       "Iztarú Alfaro Guerrero",             PLN,  "San José"],
  ["dep-rafael-vargas",       "Rafael Ángel Vargas Brenes",         PLN,  "San José"],
  ["dep-andrea-valverde",     "Andrea Valverde Palavicini",         PLN,  "San José"],
  ["dep-marco-badilla",       "Marco Badilla Chavarría",            PLN,  "San José"],
  ["dep-karen-alfaro",        "Karen Alfaro Jiménez",               PLN,  "Alajuela"],
  ["dep-diana-murillo",       "Diana Murillo Murillo",              PLN,  "Alajuela"],
  ["dep-eder-hernandez",      "Eder Hernández Ulloa",               PLN,  "Alajuela"],
  ["dep-janice-sandi",        "Janice Sandí Morales",               PLN,  "Cartago"],
  ["dep-salvador-padilla",    "Salvador Padilla Villanueva",        PLN,  "Cartago"],
  ["dep-victor-hidalgo",      "Víctor Manuel Hidalgo Solís",        PLN,  "Heredia"],
  ["dep-angela-aguilar",      "Ángela Aguilar Vargas",              PLN,  "Heredia"],
  ["dep-ronald-campos",       "Ronald Campos Villegas",             PLN,  "Guanacaste"],
  ["dep-karol-matamoros",     "Karol Matamoros Montoya",            PLN,  "Guanacaste"],
  ["dep-norjelens-lobo",      "Norjelens Lobo Vargas",              PLN,  "Puntarenas"],
  ["dep-jesus-calderon",      "Jesús Calderón Calderón",            PLN,  "Puntarenas"],
  ["dep-mangell-mclean",      "Mangell Mc Lean Villalobos",         PLN,  "Limón"],

  // ── Frente Amplio — 7 escaños ───────────────────────────────────────
  ["dep-jose-villalta",       "José María Villalta Flórez-Estrada", FA,   "San José"],
  ["dep-vianey-mora",         "Vianey Mora Vega",                   FA,   "San José"],
  ["dep-antonio-trejos",      "Antonio Trejos Mazariegos",          FA,   "San José"],
  ["dep-edgardo-araya",       "Edgardo Araya Sibaja",               FA,   "Alajuela"],
  ["dep-sigrid-segura",       "Sigrid Segura Artavia",              FA,   "Alajuela"],
  ["dep-joselyn-saenz",       "Joselyn Sáenz Núñez",                FA,   "Cartago"],
  ["dep-maria-roman",         "María Eugenia Román Mora",           FA,   "Heredia"],

  // ── Coalición Agenda Ciudadana — 1 escaño ───────────────────────────
  ["dep-claudia-dobles",      "Claudia Dobles Camargo",             CAC,  "San José"],

  // ── PUSC — 1 escaño ────────────────────────────────────────────────
  ["dep-abril-gordienko",     "Abril Gordienko López",              USC,  "San José"],
];

// ── Construcción del SEED ─────────────────────────────────────────────────

const SEED: SeedRow[] = DIPUTADOS.map(([id, nombre, partido, provincia]) => {
  const { raw, realMetrics } = buildRaw(id);
  return { id, nombre, partido, provincia, raw, realMetrics, photoUrl: photoUrl(nombre) };
});

// ── Snapshots ────────────────────────────────────────────────────────────
// Historia real: por ahora un único snapshot por corte de datos. La tendencia
// se activará cuando el workflow semanal acumule más de un corte.

function makeSnapshots(overall: number, metrics: ScoreMetrics, scoreId: string): ScoreSnapshot[] {
  return [
    {
      id: `${scoreId}-snap-0`,
      takenAt: REAL_DATA_INFO.updatedAt,
      source: REAL_DATA_INFO.source,
      overall,
      deltaOverall: null,
      metrics,
    },
  ];
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
      const overall   = calcOverall(metrics, { includeVIA: HAS_TRIPS });
      const snapshots = makeSnapshots(overall, metrics, r.id);

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
      return { card, snapshots, latestDelta: null };
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
  const overall = calcOverall(metrics, { includeVIA: HAS_TRIPS });
  const snapshots = makeSnapshots(overall, metrics, row.id);
  return { row, metrics, overall, snapshots, rawData: row.raw, bills: [] as LegislativeBill[] };
}

export function getMockBillsById(_id: string): LegislativeBill[] {
  return [];
}
