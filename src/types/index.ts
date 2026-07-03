export type PoliticianType = "diputado" | "alcalde" | "ejecutivo";

export interface ScoreMetrics {
  ASI: number; // Asistencia plenario
  COM: number; // Asistencia comisiones
  PRO: number; // Proyectos presentados
  APR: number; // Proyectos aprobados
  MOC: number; // Mociones presentadas
  DEC: number; // Declaración de bienes
  GAS: number; // Gasto representación
  VIA: number; // Viajes oficiales
  ASE: number; // Asesores parlamentarios
  VOT: number; // Participación votaciones
  COH: number; // Coherencia de voto
}

export interface RawData {
  sesionesAsistidas?: number;
  sesionesTotales?: number;
  votacionesParticipadas?: number;
  votacionesTotales?: number;
  proyectosPresentados?: number;
  proyectosAprobados?: number;
  mociones?: number;
  comisionesAsistidas?: number;
  comisionesTotales?: number;
  declaracionEstado?: "al_dia" | "atrasada" | "no_presento";
  gastoRepresentacion?: number;
  gastoPresupuesto?: number;
  viajesOficiales?: number;
  asesoresCount?: number;
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
    weight: 0.075, // 7.5% de 15% presencia
    higherIsBetter: true,
  },
  COM: {
    label: "Asistencia Comisiones",
    description: "Sesiones de comisión a las que asistió",
    source: "Asamblea Open Data",
    weight: 0.075,
    higherIsBetter: true,
  },
  PRO: {
    label: "Proyectos de Ley",
    description: "Proyectos de ley presentados (relativo al promedio)",
    source: "Asamblea Open Data",
    weight: 0.083,
    higherIsBetter: true,
  },
  APR: {
    label: "Proyectos Aprobados",
    description: "Proporción de proyectos que lograron aprobarse",
    source: "Asamblea Open Data",
    weight: 0.083,
    higherIsBetter: true,
  },
  MOC: {
    label: "Mociones",
    description: "Mociones presentadas (relativo al promedio)",
    source: "Asamblea Open Data",
    weight: 0.084,
    higherIsBetter: true,
  },
  DEC: {
    label: "Declaración de Bienes",
    description: "Presentó declaración jurada de bienes ante la CGR",
    source: "CGR",
    weight: 0.2,
    higherIsBetter: true,
  },
  GAS: {
    label: "Gasto de Representación",
    description: "Uso del presupuesto de representación vs promedio",
    source: "Asamblea Open Data",
    weight: 0.05,
    higherIsBetter: false,
  },
  VIA: {
    label: "Viajes Oficiales",
    description: "Viajes oficiales realizados vs promedio del período",
    source: "Asamblea Open Data",
    weight: 0.05,
    higherIsBetter: false,
  },
  ASE: {
    label: "Asesores Parlamentarios",
    description: "Número de asesores vs promedio del período",
    source: "Asamblea Open Data",
    weight: 0.05,
    higherIsBetter: false,
  },
  VOT: {
    label: "Participación en Votaciones",
    description: "Votaciones en las que participó del total",
    source: "Asamblea Open Data",
    weight: 0.075,
    higherIsBetter: true,
  },
  COH: {
    label: "Coherencia de Voto",
    description: "Consistencia de voto con posición pública declarada",
    source: "Delfino.cr",
    weight: 0.075,
    higherIsBetter: true,
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
  presencia: { label: "Presencia", metrics: ["ASI", "COM"] as const, weight: 0.15, color: "#3b82f6" },
  productividad: { label: "Productividad", metrics: ["PRO", "APR", "MOC"] as const, weight: 0.25, color: "#10b981" },
  transparencia: { label: "Transparencia", metrics: ["DEC"] as const, weight: 0.20, color: "#f59e0b" },
  gasto: { label: "Gasto", metrics: ["GAS", "VIA", "ASE"] as const, weight: 0.15, color: "#ef4444" },
  consistencia: { label: "Consistencia", metrics: ["VOT", "COH"] as const, weight: 0.15, color: "#8b5cf6" },
};
