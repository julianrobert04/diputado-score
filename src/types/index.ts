export type PoliticianType = "diputado" | "alcalde" | "ejecutivo";

export interface ScoreMetrics {
  ASI: number; // Asistencia plenario
  COM: number; // Asistencia comisiones
  PER: number; // Permisos / ausencias justificadas
  COS: number; // Costo del despacho (salarios de asesores)
  ASE: number; // Cantidad de asesores
  MED: number; // Cobertura mediática (sentimiento)
  VIA: number; // Viajes oficiales
}

export interface RawData {
  sesionesAsistidas?: number;
  sesionesTotales?: number;
  comisionesAsistidas?: number;
  comisionesTotales?: number;
  permisos?: number;
  permisosTotales?: number;
  costoDespacho?: number;
  asesoresCount?: number;
  viajesOficiales?: number;
  medPos?: number;
  medNeg?: number;
  medNeu?: number;
  [key: string]: unknown;
}

export interface Score {
  id: string;
  periodId: string;
  overall: number;
  metrics: ScoreMetrics;
  rawData: RawData;
}

export interface Period {
  id: string;
  politicianId: string;
  startDate: string;
  endDate: string;
  party: string;
  score?: Score;
}

export interface Politician {
  id: string;
  fullName: string;
  type: PoliticianType;
  party: string;
  province: string;
  photoUrl?: string;
  active: boolean;
  periods: Period[];
}

export interface PoliticianCard {
  id: string;
  fullName: string;
  type: PoliticianType;
  party: string;
  province: string;
  photoUrl?: string;
  active: boolean;
  overall: number;
  metrics: ScoreMetrics;
  period: {
    startDate: string;
    endDate: string;
  };
}

// Metadata de las métricas para la UI
export const METRIC_META: Record<
  keyof ScoreMetrics,
  { label: string; description: string; source: string; weight: number; higherIsBetter: boolean }
> = {
  ASI: {
    label: "Asistencia Plenario",
    description: "Sesiones del plenario a las que asistió",
    source: "Asamblea Open Data",
    weight: 0.15,
    higherIsBetter: true,
  },
  COM: {
    label: "Asistencia Comisiones",
    description: "Sesiones de comisión a las que asistió",
    source: "Asamblea Open Data",
    weight: 0.15,
    higherIsBetter: true,
  },
  PER: {
    label: "Permisos",
    description: "Ausencias justificadas con permiso vs promedio del período",
    source: "Asamblea Open Data",
    weight: 0.15,
    higherIsBetter: false,
  },
  COS: {
    label: "Costo del Despacho",
    description: "Suma de salarios de sus asesores vs promedio",
    source: "Asamblea Open Data (salarios)",
    weight: 0.12,
    higherIsBetter: false,
  },
  ASE: {
    label: "Asesores",
    description: "Cantidad de asesores vs promedio del período",
    source: "Asamblea Open Data (salarios)",
    weight: 0.09,
    higherIsBetter: false,
  },
  MED: {
    label: "Cobertura Mediática",
    description: "Noticias positivas suman, negativas restan; sin noticias es neutro",
    source: "Google News + Claude",
    weight: 0.25,
    higherIsBetter: true,
  },
  VIA: {
    label: "Viajes Oficiales",
    description: "Viajes oficiales al exterior vs promedio del período",
    source: "Asamblea Open Data",
    weight: 0.09,
    higherIsBetter: false,
  },
};

export interface ScoreSnapshot {
  id: string;
  takenAt: string;       // ISO date
  source: string;
  overall: number;
  deltaOverall: number | null;  // null = primer snapshot
  metrics: ScoreMetrics;
}

export interface ScoreTrend {
  current: number;
  previous: number | null;
  delta: number | null;        // positivo = subió, negativo = bajó
  direction: "up" | "down" | "neutral";
  snapshots: ScoreSnapshot[];  // últimos N días para la sparkline
}

export type BillStatus = "en_comision" | "aprobado" | "archivado" | "vetado" | "en_plenario" | "en_primer_debate";

export interface LegislativeBill {
  expediente: string;           // ej. "23.456"
  title: string;
  status: BillStatus;
  submittedAt: string;          // ISO date
  approvedAt?: string;
  summary?: string;
  publicUrl?: string;           // enlace a SINALEVI / Asamblea
  coauthors?: string[];
}

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  en_comision:      "En comisión",
  aprobado:         "Aprobado",
  archivado:        "Archivado",
  vetado:           "Vetado",
  en_plenario:      "En plenario",
  en_primer_debate: "Primer debate",
};

export const BILL_STATUS_COLOR: Record<BillStatus, string> = {
  en_comision:      "text-sky-400 bg-sky-400/10 ring-sky-400/20",
  aprobado:         "text-emerald-400 bg-emerald-400/10 ring-emerald-400/20",
  archivado:        "text-zinc-500 bg-zinc-500/10 ring-zinc-500/20",
  vetado:           "text-rose-400 bg-rose-400/10 ring-rose-400/20",
  en_plenario:      "text-violet-400 bg-violet-400/10 ring-violet-400/20",
  en_primer_debate: "text-amber-400 bg-amber-400/10 ring-amber-400/20",
};

export const DIMENSION_META = {
  presencia:  { label: "Presencia",       metrics: ["ASI", "COM", "PER"] as const, weight: 0.45, color: "#3b82f6" },
  austeridad: { label: "Austeridad",      metrics: ["COS", "ASE", "VIA"] as const, weight: 0.30, color: "#ef4444" },
  imagen:     { label: "Imagen Pública",  metrics: ["MED"] as const,               weight: 0.25, color: "#10b981" },
};
