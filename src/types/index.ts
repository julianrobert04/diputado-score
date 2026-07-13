export type PoliticianType = "diputado" | "alcalde" | "ejecutivo";

export interface ScoreMetrics {
  ASI: number; // Asistencia: promedio de sesiones del plenario y votaciones (Delfino, al día)
  COM: number; // Asistencia comisiones
  PER: number; // Permisos / ausencias justificadas
  PRO: number; // Proyectos de ley presentados (primera firma)
  APR: number; // Tasa de aprobación de sus proyectos
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
  viajesOficiales?: number;
  votacionesAsistidas?: number;
  votacionesTotales?: number;
  proyectosPresentados?: number;
  proyectosAprobados?: number;
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
    label: "Asistencia",
    description: "Promedio entre sesiones del plenario a las que asistió y votaciones en las que estuvo presente — al día, sube y baja cada semana",
    source: "Delfino.cr / Asamblea",
    weight: 0.3,
    higherIsBetter: true,
  },
  PRO: {
    label: "Proyectos Presentados",
    description: "Proyectos de ley con su primera firma vs promedio del período",
    source: "Delfino.cr / Asamblea",
    weight: 0.3,
    higherIsBetter: true,
  },
  COM: {
    label: "Asistencia Comisiones",
    description: "Sesiones de comisión a las que asistió",
    source: "Asamblea Open Data",
    weight: 0.1,
    higherIsBetter: true,
  },
  PER: {
    label: "Permisos",
    description: "Ausencias justificadas con permiso vs promedio del período",
    source: "Asamblea Open Data",
    weight: 0.1,
    higherIsBetter: false,
  },
  APR: {
    label: "Proyectos Aprobados",
    description: "Tasa de aprobación de sus proyectos; sin aprobados aún queda neutro (las leyes toman años)",
    source: "Delfino.cr / Asamblea",
    weight: 0.1,
    higherIsBetter: true,
  },
  MED: {
    label: "Cobertura Mediática",
    description: "Noticias acumuladas desde el inicio de la legislatura: positivas suman, negativas restan; sin noticias es neutro",
    source: "Google News + Claude",
    weight: 0.1,
    higherIsBetter: true,
  },
  VIA: {
    label: "Viajes Oficiales",
    description: "Viajes oficiales al exterior vs promedio — se activa cuando la Asamblea publique los datos",
    source: "Asamblea Open Data",
    weight: 0,
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

// El overall es una suma ponderada por métrica (ver METRIC_WEIGHTS en
// scoreCalculator). Estas dimensiones agrupan las métricas para la UI;
// weight = suma de los pesos de sus métricas. Cuando haya datos de viajes,
// VIA entra con 15% y el resto se escala ×0.85.
export const DIMENSION_META = {
  presencia:     { label: "Presencia",      metrics: ["ASI", "COM", "PER"] as const, weight: 0.5, color: "#3b82f6" },
  productividad: { label: "Productividad",  metrics: ["PRO", "APR"] as const,        weight: 0.4, color: "#a78bfa" },
  imagen:        { label: "Imagen Pública", metrics: ["MED"] as const,               weight: 0.1, color: "#10b981" },
};
