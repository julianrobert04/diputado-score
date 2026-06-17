/**
 * DiputadoScore — Calculador de métricas y score general
 *
 * Pesos por dimensión:
 *   Presencia     (ASI + COM):         15%
 *   Productividad (PRO + APR + MOC):   25%
 *   Transparencia (DEC):               20%
 *   Gasto         (GAS + VIA + ASE):   15%
 *   Consistencia  (VOT + COH):         15%
 *   Ciudadanía:                        10% → fallback a promedio del resto por ahora
 */

import { RawData, ScoreMetrics } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a value between 0 and 10 */
const clamp = (v: number): number => Math.max(0, Math.min(10, v));

/** Score logarítmico relativo al promedio del período.
 *  Si el diputado está en el promedio → 5.0
 *  Si dobla el promedio → ~8.3
 *  Si está en cero → 0
 */
function logRelativeScore(value: number, avg: number): number {
  if (avg <= 0) return value > 0 ? 8 : 0;
  if (value <= 0) return 0;
  // log ratio: ln(x/avg) normalizado a [-5, +5] → escala 0-10
  const ratio = Math.log(value / avg + 1) / Math.log(2); // base-2 log
  return clamp(5 + ratio * 2.5);
}

/** Score inversamente proporcional.
 *  Si está en el promedio → 5.0
 *  Menos que el promedio → sube hacia 10
 *  Más que el promedio → baja hacia 0
 */
function inverseRelativeScore(value: number, avg: number): number {
  if (avg <= 0) return value === 0 ? 10 : 5;
  const ratio = value / avg;
  // ratio=0 → 10, ratio=1 → 5, ratio=2 → 0
  return clamp(10 - ratio * 5);
}

// ─── Cálculo de métricas individuales ─────────────────────────────────────────

export interface PeriodAverages {
  avgProyectos: number;
  avgMociones: number;
  avgViajes: number;
  avgAsesores: number;
  avgGastoPct: number; // % del presupuesto usado, promedio
}

export function calcMetrics(raw: RawData, avgs: PeriodAverages): ScoreMetrics {
  // ASI: Asistencia plenario
  const ASI = clamp(
    raw.sesionesTotales && raw.sesionesTotales > 0
      ? ((raw.sesionesAsistidas ?? 0) / raw.sesionesTotales) * 10
      : 5
  );

  // VOT: Participación en votaciones
  const VOT = clamp(
    raw.votacionesTotales && raw.votacionesTotales > 0
      ? ((raw.votacionesParticipadas ?? 0) / raw.votacionesTotales) * 10
      : 5
  );

  // PRO: Proyectos presentados (relativo al promedio, escala log)
  const PRO = logRelativeScore(raw.proyectosPresentados ?? 0, avgs.avgProyectos);

  // APR: Proyectos aprobados
  const APR =
    raw.proyectosPresentados && raw.proyectosPresentados > 0
      ? clamp(((raw.proyectosAprobados ?? 0) / raw.proyectosPresentados) * 10)
      : 0;

  // MOC: Mociones (relativo al promedio, escala log)
  const MOC = logRelativeScore(raw.mociones ?? 0, avgs.avgMociones);

  // COM: Asistencia comisiones
  const COM = clamp(
    raw.comisionesTotales && raw.comisionesTotales > 0
      ? ((raw.comisionesAsistidas ?? 0) / raw.comisionesTotales) * 10
      : 5
  );

  // DEC: Declaración de bienes
  let DEC: number;
  switch (raw.declaracionEstado) {
    case "al_dia":
      DEC = 10;
      break;
    case "atrasada":
      DEC = 5;
      break;
    case "no_presento":
    default:
      DEC = 0;
  }

  // GAS: Gasto de representación (inversamente proporcional)
  const gastoPct =
    raw.gastoPresupuesto && raw.gastoPresupuesto > 0
      ? ((raw.gastoRepresentacion ?? 0) / raw.gastoPresupuesto) * 100
      : 0;
  const GAS = inverseRelativeScore(gastoPct, avgs.avgGastoPct);

  // VIA: Viajes oficiales (inversamente proporcional)
  const VIA = inverseRelativeScore(raw.viajesOficiales ?? 0, avgs.avgViajes);

  // ASE: Asesores (inversamente proporcional)
  const ASE = inverseRelativeScore(raw.asesoresCount ?? 0, avgs.avgAsesores);

  // COH: Coherencia de voto (editado manualmente o datos Delfino — por ahora = 5 si no hay dato)
  const COH = typeof raw.coherenciaVoto === "number" ? clamp(raw.coherenciaVoto) : 5;

  return { ASI, VOT, PRO, APR, MOC, COM, DEC, GAS, VIA, ASE, COH };
}

// ─── Cálculo del score general (overall) ──────────────────────────────────────

export function calcOverall(m: ScoreMetrics): number {
  // Presencia 15%
  const presencia = (m.ASI + m.COM) / 2;

  // Productividad 25%
  const productividad = (m.PRO + m.APR + m.MOC) / 3;

  // Transparencia 20%
  const transparencia = m.DEC;

  // Gasto 15%
  const gasto = (m.GAS + m.VIA + m.ASE) / 3;

  // Consistencia 15%
  const consistencia = (m.VOT + m.COH) / 2;

  // Ciudadanía 10% — promedio de las demás dimensiones mientras se define
  const ciudadania = (presencia + productividad + transparencia + gasto + consistencia) / 5;

  const overall =
    presencia * 0.15 +
    productividad * 0.25 +
    transparencia * 0.2 +
    gasto * 0.15 +
    consistencia * 0.15 +
    ciudadania * 0.1;

  return Math.round(overall * 10) / 10; // 1 decimal
}

// ─── Score de color (igual que SofaScore) ────────────────────────────────────

export type ScoreColor = "gold" | "green" | "yellow" | "orange" | "red" | "gray";

export function getScoreColor(score: number): ScoreColor {
  if (score >= 9) return "gold";
  if (score >= 7) return "green";
  if (score >= 5.5) return "yellow";
  if (score >= 4) return "orange";
  if (score > 0) return "red";
  return "gray";
}

export const SCORE_COLOR_CLASSES: Record<ScoreColor, string> = {
  gold: "bg-yellow-400 text-yellow-900",
  green: "bg-emerald-500 text-white",
  yellow: "bg-yellow-500 text-white",
  orange: "bg-orange-500 text-white",
  red: "bg-red-600 text-white",
  gray: "bg-gray-400 text-white",
};

export const SCORE_BORDER_CLASSES: Record<ScoreColor, string> = {
  gold: "border-yellow-400",
  green: "border-emerald-500",
  yellow: "border-yellow-500",
  orange: "border-orange-500",
  red: "border-red-600",
  gray: "border-gray-400",
};
