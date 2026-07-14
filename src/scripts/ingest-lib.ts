/**
 * DiputadoScore — Funciones puras de la ingesta (importables sin efectos)
 *
 * Este módulo NO ejecuta I/O al importarse: solo define funciones y constantes
 * puras de matching, parseo y validación. `ingest-opendata.ts` (que corre
 * `main()` al importarse) reutiliza todo esto, y las pruebas lo importan sin
 * disparar la corrida de red.
 *
 * Solo imports relativos/builtin (sin alias `@/`) para que `tsx` lo corra
 * de forma independiente.
 */

import crypto from "crypto";
import * as XLSX from "xlsx";

// ─── Tipos compartidos ───────────────────────────────────────────────────────

/** Par [id, nombre] del roster, con tokens normalizados para el matcher */
export interface Deputy {
  id: string;
  nombre: string;
  tokens: string[];
}

export interface Attendance {
  asisPL: number;
  ausPL: number;
  permPL: number;
  asisCom: number;
  ausCom: number;
  permCom: number;
}

export interface MedData {
  pos: number;
  neg: number;
  neu: number;
  total: number;
}

/** Acumulado por diputado que se escribe a data/real-data.json */
export type DeputyTotals = Attendance & {
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
};

// ─── Constantes de configuración (exportadas para pruebas) ───────────────────

/** Piso de diputados con datos de asistencia para permitir la escritura.
 *  Deliberadamente por debajo de las 57 curules para tolerar vacantes reales. */
export const MIN_DIPUTADOS = 50;

/** Margen mínimo entre el mejor y el segundo mejor match para aceptar un nombre.
 *  Si la diferencia es menor, el match se considera ambiguo y se rechaza. */
export const AMBIGUITY_MARGIN = 0.15;

/** Umbral mínimo de score Jaccard para considerar un match válido */
export const MATCH_THRESHOLD = 0.6;

/** Timeout de socket y de respuesta para cada request HTTP (ms) */
export const REQUEST_TIMEOUT_MS = 30_000;

// ─── Normalización y distancia de nombres ────────────────────────────────────

export function normalize(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .sort();
}

export function editDistance1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// Jaccard con tolerancia a typos oficiales de la Asamblea (ej: "Chavaría")
export function jaccard(a: string[], b: string[]): number {
  const sa = [...new Set(a)];
  const sb = [...new Set(b)];
  const inter = sa.filter((t) =>
    sb.some((u) => (t.length >= 5 ? editDistance1(t, u) : t === u)),
  ).length;
  return inter / (sa.length + sb.length - inter);
}

// La Asamblea publica apellidos inconsistentes para algunos diputados
export const NAME_ALIASES: Record<string, string> = {
  "saenz blanco joselyn": "dep-joselyn-saenz",
  "saenz nuñez joselyn fabiola": "dep-joselyn-saenz",
};

/** Resultado de un intento de match: id encontrado, o null con la razón
 *  (ambiguo = dos candidatos demasiado cercanos; sin-match = nadie superó el
 *  umbral) para poder distinguirlo en el reporte de no-matcheados. */
export type MatchResult =
  | { id: string; score: number }
  | {
      id: null;
      reason: "ambiguo" | "sin-match";
      best: string | null;
      score: number;
    };

/** Match con detalle de la razón cuando no hay match (para el reporte). */
export function matchDeputyResult(
  xlsxName: string,
  deputies: Deputy[],
): MatchResult {
  const aliasKey = normalize(xlsxName).sort().join(" ");
  for (const [alias, id] of Object.entries(NAME_ALIASES)) {
    if (normalize(alias).sort().join(" ") === aliasKey) return { id, score: 1 };
  }
  const tokens = normalize(xlsxName);
  let best: { id: string; score: number } | null = null;
  let secondBest = -Infinity;
  for (const dep of deputies) {
    const score = jaccard(tokens, dep.tokens);
    if (!best || score > best.score) {
      if (best) secondBest = best.score;
      best = { id: dep.id, score };
    } else if (score > secondBest) {
      secondBest = score;
    }
  }
  if (!best || best.score < MATCH_THRESHOLD) {
    return {
      id: null,
      reason: "sin-match",
      best: best?.id ?? null,
      score: best?.score ?? 0,
    };
  }
  // Rechazo por ambigüedad: el segundo candidato está demasiado cerca del mejor.
  if (best.score - secondBest < AMBIGUITY_MARGIN) {
    return { id: null, reason: "ambiguo", best: best.id, score: best.score };
  }
  return { id: best.id, score: best.score };
}

/** Match clásico: devuelve el id o null (compatibilidad con llamadores/pruebas) */
export function matchDeputy(
  xlsxName: string,
  deputies: Deputy[],
): string | null {
  return matchDeputyResult(xlsxName, deputies).id;
}

// ─── Proyectos de ley: estado aprobado ───────────────────────────────────────

/** Estado final aprobado (no cuenta "Aprobado en Primer Debate") */
export function isApproved(status: string): boolean {
  const s = status.toLowerCase();
  if (s.includes("primer debate")) return false;
  return s.includes("aprobado") || s.includes("resellado");
}

// ─── Nombre de búsqueda para medios ──────────────────────────────────────────

/** Nombre corto de búsqueda: "Nombre(s) Apellido1" a partir del formato xlsx
 *  "Apellido1 Apellido2 Nombre(s)" — es como los medios nombran a los diputados. */
export function searchName(nombreXlsx: string, fullName: string): string {
  const t = nombreXlsx.trim().split(/\s+/).filter(Boolean);
  if (t.length >= 3) {
    const nombres = t.slice(2).join(" ");
    return `${nombres} ${t[0]}`;
  }
  return fullName;
}

/** Hash estable de un titular (normalizado) para no contarlo dos veces
 *  entre corridas semanales con ventanas de búsqueda que se traslapan. */
export function headlineHash(title: string): string {
  return crypto
    .createHash("sha1")
    .update(normalize(title).join(" "))
    .digest("hex")
    .slice(0, 12);
}

// ─── Validación de bytes antes de parsear xlsx ───────────────────────────────

/** Un .xlsx es un ZIP: debe empezar con la firma "PK\x03\x04" (50 4B 03 04).
 *  Rechaza páginas de error HTML u otros bytes que no son un workbook. */
export function isZipBuffer(buf: Buffer | null | undefined): boolean {
  return (
    !!buf &&
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    buf[2] === 0x03 &&
    buf[3] === 0x04
  );
}

/** Content-type que NO es un archivo binario descargable (páginas de error). */
export function isHtmlContentType(ct: string | undefined | null): boolean {
  if (!ct) return false;
  const lower = ct.toLowerCase();
  return lower.includes("text/html") || lower.includes("application/xhtml");
}

// ─── Parseo de asistencia (xlsx mensual de la Asamblea) ──────────────────────

/** Excepción usada para señalar que un mes no es utilizable (no es "cero
 *  asistencia", es "mes no disponible"): columnas requeridas ausentes o sin
 *  filas de datos. El llamador la trata como mes faltante. */
export class MonthUnavailableError extends Error {}

export function parseAttendance(buf: Buffer): Map<string, Attendance> {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
  });
  const header = (rows[0] ?? []).map((h) =>
    String(h ?? "")
      .replace(/\s+/g, " ")
      .trim(),
  );

  const nameIdx = header.findIndex((h) => /^nombre$/i.test(h));
  const col = (label: string) =>
    header.findIndex((h) => h.toLowerCase() === label.toLowerCase());

  // Columnas de comisiones: todo Asis/Aus/Perm que no sea del Plenario (PL)
  const comCols = {
    asis: [] as number[],
    aus: [] as number[],
    perm: [] as number[],
  };
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

  // Guarda de sanidad: si las columnas requeridas no están, el archivo no es
  // el registro de asistencia esperado (formato cambiado o página de error
  // servida como xlsx) → mes no disponible, NUNCA "cero asistencia".
  if (nameIdx < 0 || asisPLIdx < 0 || ausPLIdx < 0) {
    throw new MonthUnavailableError(
      "columnas requeridas ausentes (Nombre / Asis PL / Aus PL) — mes no disponible",
    );
  }

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

  // Sin filas de datos → mes no disponible (no confundir con cero asistencia).
  if (out.size === 0) {
    throw new MonthUnavailableError("sin filas de datos — mes no disponible");
  }
  return out;
}

// ─── Semilla, backfill y freno de regresión (helpers puros) ──────────────────

/** Semilla de `totals` con las 57 curules del roster: asistencia en cero,
 *  métricas en null. Garantiza que TODAS las entradas existan antes de los
 *  loops de fetch, para que un diputado nunca desaparezca por un outage. */
export function seedTotals(deputies: Deputy[]): Map<string, DeputyTotals> {
  const totals = new Map<string, DeputyTotals>();
  for (const dep of deputies) {
    totals.set(dep.id, {
      asisPL: 0,
      ausPL: 0,
      permPL: 0,
      asisCom: 0,
      ausCom: 0,
      permCom: 0,
      viajes: 0,
      proyectos: null,
      aprobados: null,
      sesAsis: null,
      sesTotal: null,
      votAsis: null,
      votTotal: null,
      med: null,
      medSeen: [],
      nombreXlsx: "",
    });
  }
  return totals;
}

const ATT_FIELDS: (keyof Attendance)[] = [
  "asisPL",
  "ausPL",
  "permPL",
  "asisCom",
  "ausCom",
  "permCom",
];

/** Suma de las seis columnas de asistencia (métrica de "cantidad de datos"). */
export function attendanceSum(
  t: Partial<Attendance> | null | undefined,
): number {
  if (!t) return 0;
  return ATT_FIELDS.reduce((acc, k) => acc + (Number(t[k]) || 0), 0);
}

/** Un diputado "tiene datos" de asistencia si asisPL+ausPL acumulados > 0. */
export function isDataBearing(
  t: Pick<Attendance, "asisPL" | "ausPL">,
): boolean {
  return (t.asisPL || 0) + (t.ausPL || 0) > 0;
}

/**
 * Backfill de asistencia desde `existing`.
 *
 * La asistencia está sembrada en cero, y `0 ?? x === 0`, así que el patrón de
 * null-backfill NUNCA puede restaurarla. Guarda especial: si un diputado del
 * roster tiene CERO asistencia fetcheada esta corrida (asisPL+ausPL === 0) pero
 * `existing` tiene asistencia acumulada no-cero, restauramos su asistencia
 * desde `existing` y lo reportamos como no-matcheado por asistencia.
 *
 * También restaura `nombreXlsx` desde `existing` cuando quedó vacío (el nombre
 * xlsx alimenta la búsqueda de noticias/MED).
 *
 * Muta `totals` y devuelve la lista de ids con asistencia restaurada.
 */
export function backfillAttendance(
  totals: Map<string, DeputyTotals>,
  existing:
    | { deputies?: Record<string, Partial<DeputyTotals>> }
    | null
    | undefined,
): string[] {
  const backfilled: string[] = [];
  const exDeputies = existing?.deputies ?? {};
  for (const [id, entry] of totals) {
    const ex = exDeputies[id];
    // Restaurar nombreXlsx si esta corrida no lo pudo setear (no matcheó).
    if (!entry.nombreXlsx && ex?.nombreXlsx) {
      entry.nombreXlsx = ex.nombreXlsx;
    }
    if (!ex) continue;
    const fetchedNonZero = (entry.asisPL || 0) + (entry.ausPL || 0) > 0;
    const existingNonZero = (ex.asisPL || 0) + (ex.ausPL || 0) > 0;
    if (!fetchedNonZero && existingNonZero) {
      for (const k of ATT_FIELDS) {
        entry[k] = Number(ex[k]) || 0;
      }
      backfilled.push(id);
    }
  }
  return backfilled;
}

/** Resultado del freno de regresión. */
export interface RegressionResult {
  ok: boolean;
  reason?: string;
  dataBearing: number;
  decreased: string[];
}

/**
 * Freno de regresión (autoridad del script): rechaza la escritura cuando
 *  (a) la cantidad de diputados CON DATOS (asisPL+ausPL acumulados > 0, tras el
 *      backfill) cae por debajo de `minDiputados`, o
 *  (b) la asistencia acumulada de CUALQUIER diputado bajó respecto a `existing`
 *      — incondicionalmente, NO condicionado a que la lista de meses se encoja
 *      (una columna renombrada da un ZIP válido lleno de ceros con la lista de
 *      meses intacta).
 *
 * Es puro: recibe (totals, existing) y no hace I/O.
 */
export function checkRegression(
  totals: Map<string, DeputyTotals>,
  existing:
    | { deputies?: Record<string, Partial<DeputyTotals>> }
    | null
    | undefined,
  minDiputados: number = MIN_DIPUTADOS,
): RegressionResult {
  let dataBearing = 0;
  for (const entry of totals.values()) {
    if (isDataBearing(entry)) dataBearing++;
  }

  const decreased: string[] = [];
  const exDeputies = existing?.deputies ?? {};
  for (const [id, entry] of totals) {
    const ex = exDeputies[id];
    if (!ex) continue;
    if (attendanceSum(entry) < attendanceSum(ex)) decreased.push(id);
  }

  if (dataBearing < minDiputados) {
    return {
      ok: false,
      reason: `diputados con datos de asistencia (${dataBearing}) por debajo del mínimo (${minDiputados})`,
      dataBearing,
      decreased,
    };
  }
  if (decreased.length) {
    return {
      ok: false,
      reason: `asistencia acumulada disminuyó para ${decreased.length} diputado(s): ${decreased.join(", ")}`,
      dataBearing,
      decreased,
    };
  }
  return { ok: true, dataBearing, decreased };
}

/**
 * Compuerta estricta del rollover de legislatura (KTD 8).
 *
 * Una desigualdad de strings a secas NUNCA debe disparar el rollover (un drift
 * de formato como "2026-2030" → "Legislatura 2026-2030" archivaría datos
 * buenos y desarmaría el freno en una sola corrida). Solo dispara cuando TODO
 * se cumple:
 *   • el término nuevo calza `^\d{4}-\d{4}$`,
 *   • su año de inicio AVANZA estrictamente sobre el término almacenado, y
 *   • toda fuente de esta corrida respondió (nunca saltar el freno en una
 *     corrida degradada).
 */
export function shouldRollover(
  newTerm: string | null | undefined,
  storedTerm: string | null | undefined,
  allSourcesHealthy: boolean,
): boolean {
  if (!allSourcesHealthy) return false;
  const fmt = /^(\d{4})-(\d{4})$/;
  const nm = newTerm ? fmt.exec(newTerm) : null;
  const sm = storedTerm ? fmt.exec(storedTerm) : null;
  if (!nm || !sm) return false;
  const newStart = Number(nm[1]);
  const storedStart = Number(sm[1]);
  return newStart > storedStart;
}
