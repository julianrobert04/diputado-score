/**
 * DiputadoScore — Calculador de métricas y score general
 *
 * 7 métricas, todas de fuentes reales. Overall = suma ponderada:
 *   Mayores (30% c/u):  ASI (sesiones + votaciones, al día), PRO (proyectos presentados)
 *   Menores (10% c/u):  COM (comisiones), PER (permisos), APR (aprobación), MED (medios)
 *   VIA (viajes): 15% cuando haya datos — el resto se escala ×0.85
 */

import { RawData, ScoreMetrics } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const clamp = (v: number, min = 0, max = 10): number => Math.max(min, Math.min(max, v));

/** Score inversamente proporcional.
 *  En el promedio → 5.0 · en cero → 10 · al doble del promedio → 0
 */
function inverseRelativeScore(value: number, avg: number): number {
  if (avg <= 0) return value === 0 ? 10 : 5;
  const ratio = value / avg;
  return clamp(10 - ratio * 5);
}

// ─── Cálculo de métricas individuales ─────────────────────────────────────────

/** Score directamente proporcional.
 *  En el promedio → 5.0 · en cero → 0 · al doble del promedio → 10
 */
function directRelativeScore(value: number, avg: number): number {
  if (avg <= 0) return value > 0 ? 10 : 5;
  return clamp((value / avg) * 5);
}

export interface PeriodAverages {
  avgPermRatio: number;  // permisos / sesiones, promedio del período
  avgViajes: number;
  avgProyectos: number;  // proyectos presentados, promedio del período
}

const METRIC_WEIGHTS: Record<Exclude<keyof ScoreMetrics, "VIA">, number> = {
  ASI: 0.3,
  PRO: 0.3,
  COM: 0.1,
  PER: 0.1,
  APR: 0.1,
  MED: 0.1,
};

export function calcMetrics(raw: RawData, avgs: PeriodAverages): ScoreMetrics {
  // ASI: Asistencia — promedio entre sesiones del plenario y votaciones (al día).
  // Si solo hay una de las dos fuentes, se usa esa; sin datos queda neutro.
  const asiRatios: number[] = [];
  if (raw.sesionesTotales && raw.sesionesTotales > 0) {
    asiRatios.push((raw.sesionesAsistidas ?? 0) / raw.sesionesTotales);
  }
  if (raw.votacionesTotales && raw.votacionesTotales > 0) {
    asiRatios.push((raw.votacionesAsistidas ?? 0) / raw.votacionesTotales);
  }
  const ASI = asiRatios.length
    ? clamp((asiRatios.reduce((a, b) => a + b, 0) / asiRatios.length) * 10)
    : 5;

  // COM: Asistencia comisiones
  const COM = clamp(
    raw.comisionesTotales && raw.comisionesTotales > 0
      ? ((raw.comisionesAsistidas ?? 0) / raw.comisionesTotales) * 10
      : 5
  );

  // PER: Permisos — proporción de sesiones justificadas con permiso, relativo al promedio
  const permRatio =
    raw.permisosTotales && raw.permisosTotales > 0
      ? (raw.permisos ?? 0) / raw.permisosTotales
      : 0;
  const PER = inverseRelativeScore(permRatio, avgs.avgPermRatio);

  // PRO: Proyectos presentados (primera firma) — más que el promedio, mejor
  const PRO =
    typeof raw.proyectosPresentados === "number"
      ? directRelativeScore(raw.proyectosPresentados, avgs.avgProyectos)
      : 5;

  // APR: Tasa de aprobación con umbral — sin proyectos o sin aprobados aún → 5.0
  // neutro (las leyes toman años); de ahí sube hasta 10 si le aprueban todos
  const propuestos = raw.proyectosPresentados ?? 0;
  const aprobados = raw.proyectosAprobados ?? 0;
  const APR =
    propuestos > 0 && aprobados > 0
      ? clamp(5 + (aprobados / propuestos) * 5, 5, 10)
      : 5;

  // MED: Cobertura mediática — positivas suman, negativas restan, sin noticias = neutro
  const medPos = raw.medPos ?? 0;
  const medNeg = raw.medNeg ?? 0;
  const medTotal = medPos + medNeg + (raw.medNeu ?? 0);
  const MED =
    medTotal > 0
      ? clamp(5.5 + 4.5 * ((medPos - medNeg) / Math.max(medTotal, 5)), 1, 10)
      : 5.5;

  // VIA: Viajes oficiales
  const VIA =
    typeof raw.viajesOficiales === "number"
      ? inverseRelativeScore(raw.viajesOficiales, avgs.avgViajes)
      : 5;

  return { ASI, COM, PER, PRO, APR, MED, VIA };
}

// ─── Cálculo del score general (overall) ──────────────────────────────────────

export interface OverallOptions {
  /** Sin xlsx de viajes de esta legislatura, VIA se excluye del overall */
  includeVIA?: boolean;
}

export function calcOverall(m: ScoreMetrics, opts: OverallOptions = {}): number {
  const base = (Object.entries(METRIC_WEIGHTS) as [keyof ScoreMetrics, number][])
    .reduce((sum, [key, w]) => sum + m[key] * w, 0);

  const overall = opts.includeVIA ? base * 0.85 + m.VIA * 0.15 : base;
  return Math.round(clamp(overall, 1, 10) * 10) / 10;
}

// ─── Score de color (igual que SofaScore) ────────────────────────────────────

export type ScoreColor = "gold" | "green" | "yellow" | "orange" | "red" | "gray";

// Siempre de verde a rojo: los mejores en verde intenso, luego amarillo, luego rojo
export function getScoreColor(score: number): ScoreColor {
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
