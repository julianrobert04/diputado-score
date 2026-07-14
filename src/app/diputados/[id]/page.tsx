import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { TrendBadge } from "@/components/TrendBadge";
import { SparklineCard } from "@/components/Sparkline";
import { RadarChart } from "@/components/RadarChart";
import {
  METRIC_META,
  DIMENSION_META,
  BILL_STATUS_LABEL,
  BILL_STATUS_COLOR,
  ScoreMetrics,
} from "@/types";
import { getScoreColor } from "@/lib/scoreCalculator";
import {
  getMockPoliticianById,
  getMockPoliticians,
  getRealMetrics,
  RealMetric,
} from "@/lib/mockData";

interface Props {
  params: Promise<{ id: string }>;
}

// Pre-renderiza (SSG) las 57 páginas de perfil a partir del roster de mockData,
// una por cada diputado. Sustituye al antiguo `force-dynamic`: los datos ya son
// estáticos en tiempo de build, así que no hay razón para renderizar bajo demanda.
export function generateStaticParams(): { id: string }[] {
  return getMockPoliticians().map(({ card }) => ({ id: card.id }));
}

const SCORE_TEXT: Record<string, string> = {
  gold: "text-amber-400",
  green: "text-emerald-400",
  yellow: "text-yellow-400",
  orange: "text-orange-400",
  red: "text-rose-400",
  gray: "text-zinc-400",
};

const RING_COLOR: Record<string, string> = {
  gold: "ring-amber-400/50",
  green: "ring-emerald-400/50",
  yellow: "ring-yellow-400/50",
  orange: "ring-orange-500/50",
  red: "ring-rose-500/50",
  gray: "ring-zinc-600/50",
};

const ACCENT_GRADIENT: Record<string, string> = {
  gold: "from-amber-400/20 to-transparent",
  green: "from-emerald-400/15 to-transparent",
  yellow: "from-yellow-400/15 to-transparent",
  orange: "from-orange-500/15 to-transparent",
  red: "from-rose-500/15 to-transparent",
  gray: "from-zinc-500/10 to-transparent",
};

const SCORE_BAR_COLOR: Record<string, string> = {
  gold: "bg-amber-400",
  green: "bg-emerald-400",
  yellow: "bg-yellow-400",
  orange: "bg-orange-400",
  red: "bg-rose-500",
  gray: "bg-zinc-600",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const mock = getMockPoliticianById(id);
    if (mock) {
      return {
        title: `${mock.row.nombre} — ${mock.overall.toFixed(1)}/10 · DiputadoScore`,
        description: `Perfil de ${mock.row.nombre} (${mock.row.partido}), provincia ${mock.row.provincia}. Score general: ${mock.overall.toFixed(1)} de 10.`,
      };
    }
  } catch {
    // noop
  }
  return {
    title: "Diputado · DiputadoScore",
    description: "Perfil de diputado en DiputadoScore Costa Rica.",
  };
}

export default async function DiputadoPage({ params }: Props) {
  const { id } = await params;

  const mock = getMockPoliticianById(id);
  if (!mock) notFound();

  const politicianName = mock.row.nombre;
  const politicianParty = mock.row.partido;
  const politicianProvince = mock.row.provincia;
  const politicianPhoto = mock.row.photoUrl ?? null;
  const politicianActive = true;
  const metrics: Record<string, number> = mock.metrics as unknown as Record<
    string,
    number
  >;
  const overall = mock.overall;
  const snapshots = mock.snapshots;
  const rawData = mock.rawData as Record<string, unknown>;
  const bills = mock.bills;
  const periodStart = "2026-05-01T00:00:00.000Z";
  const periodEnd = "2030-04-30T00:00:00.000Z";
  const allPeriods: {
    id: string;
    startDate: Date;
    endDate: Date;
    party: string;
    score: { overall: number } | null;
  }[] = [];

  const color = getScoreColor(overall);
  const latestSnapshot = snapshots[snapshots.length - 1] ?? null;

  // Ranking entre los 57 diputados
  const allPoliticians = getMockPoliticians("", "", "overall_desc");
  const rankIndex = allPoliticians.findIndex((p) => p.card.id === id);
  const realMetrics = getRealMetrics(id);
  const rankPosition = rankIndex >= 0 ? rankIndex + 1 : null;
  const totalDiputados = allPoliticians.length;

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0c0c0e]/80 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-[1.05rem] font-black tracking-tight text-white">
              Diputado<span className="text-emerald-400">Score</span>
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Todos los diputados
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 pt-8 pb-16">
        {/* ── HERO ── */}
        <div className="relative bg-zinc-900 rounded-3xl overflow-hidden ring-1 ring-white/[0.06] mb-5">
          <div
            className={`absolute inset-0 bg-gradient-to-br ${ACCENT_GRADIENT[color]} pointer-events-none`}
          />

          <span className="absolute right-0 top-0 text-[12rem] font-black leading-none text-white/[0.025] select-none pointer-events-none translate-x-8 -translate-y-4">
            {politicianName.charAt(0)}
          </span>

          <div className="relative p-7 sm:p-10">
            <div className="flex flex-col sm:flex-row items-start gap-8">
              {/* Left: photo + party */}
              <div className="flex items-center gap-5 sm:flex-col sm:items-center sm:gap-3 sm:w-36">
                <div
                  className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 ${RING_COLOR[color]} bg-zinc-800 flex-shrink-0 shadow-2xl shadow-black/50`}
                >
                  {politicianPhoto ? (
                    // `unoptimized`: las fotos vienen de www.asamblea.go.cr, cuyo
                    // servidor omite el CA intermedio de su cadena TLS. El optimizador
                    // de imágenes de Next (proceso Node) no puede verificar esa cadena
                    // y fallaría la descarga, dejando a cada retrato en el fallback de
                    // la inicial. Servimos el original sin optimizar para evitarlo.
                    <Image
                      src={politicianPhoto}
                      alt={politicianName}
                      fill
                      className="object-cover"
                      sizes="96px"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl font-black text-zinc-400 select-none">
                      {politicianName.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="hidden sm:block text-center">
                  <p className="text-zinc-500 text-[0.65rem] leading-snug line-clamp-2 text-center">
                    {politicianParty}
                  </p>
                </div>
              </div>

              {/* Center: name + meta + ranking */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight mb-1">
                  {politicianName}
                </h1>
                <p className="text-zinc-500 text-sm sm:hidden mb-1">
                  {politicianParty}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                  <span className="flex items-center gap-1.5 text-zinc-500 text-sm">
                    <svg
                      className="w-3.5 h-3.5 text-zinc-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    {politicianProvince}
                  </span>
                  {periodStart && (
                    <span className="text-zinc-300 text-sm">
                      {new Date(periodStart).getFullYear()}–
                      {periodEnd ? new Date(periodEnd).getFullYear() : ""}
                    </span>
                  )}
                  {!politicianActive && (
                    <span className="text-[0.65rem] bg-zinc-800/80 text-zinc-500 px-2 py-0.5 rounded-full border border-zinc-700/60">
                      Histórico
                    </span>
                  )}
                </div>

                {/* Ranking badge */}
                {rankPosition !== null && (
                  <div className="mt-4 inline-flex items-center gap-2 bg-zinc-800/70 rounded-xl px-3 py-2 ring-1 ring-white/[0.05]">
                    <span
                      className={`${SCORE_TEXT[color]} text-lg font-black tabular-nums leading-none`}
                    >
                      #{rankPosition}
                    </span>
                    <span className="text-zinc-500 text-xs">
                      de {totalDiputados} diputados
                    </span>
                  </div>
                )}

                {/* Dimension pills */}
                {metrics && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {Object.entries(DIMENSION_META).map(([key, dim]) => {
                      const dimScore =
                        dim.metrics.reduce(
                          (sum, m) => sum + (metrics[m] ?? 0),
                          0,
                        ) / dim.metrics.length;
                      const dimColor = getScoreColor(dimScore);
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-1.5 bg-zinc-800/70 rounded-lg px-2.5 py-1.5 ring-1 ring-white/[0.05]"
                        >
                          <span
                            className={`${SCORE_TEXT[dimColor]} text-sm font-black tabular-nums`}
                          >
                            {dimScore.toFixed(1)}
                          </span>
                          <span className="text-zinc-500 text-[0.65rem]">
                            {dim.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: BIG score */}
              <div className="sm:flex-shrink-0 flex sm:flex-col items-center gap-3 sm:gap-1 sm:items-end">
                <div
                  className={`${SCORE_TEXT[color]} text-[4.5rem] sm:text-[5.5rem] font-black tabular-nums leading-none tracking-tight`}
                >
                  {overall.toFixed(1)}
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
                  {latestSnapshot?.deltaOverall !== undefined && (
                    <TrendBadge delta={latestSnapshot.deltaOverall} size="md" />
                  )}
                  {latestSnapshot && (
                    <span className="text-[0.65rem] text-zinc-300">
                      {new Date(latestSnapshot.takenAt).toLocaleDateString(
                        "es-CR",
                        { day: "numeric", month: "short" },
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Radar + Sparkline row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          {metrics && (
            <div className="bg-zinc-900 rounded-2xl ring-1 ring-white/[0.06] p-6 flex flex-col items-center justify-center">
              <h2 className="text-sm font-semibold text-zinc-400 mb-4 self-start">
                Perfil por dimensión
              </h2>
              <RadarChart
                metrics={metrics as unknown as ScoreMetrics}
                size={220}
              />
            </div>
          )}
          <div className="bg-zinc-900 rounded-2xl ring-1 ring-white/[0.06] p-6">
            <SparklineCard
              snapshots={snapshots}
              title="Evolución (últimos 90 días)"
            />
          </div>
        </div>

        {/* 11 metrics — animated progress bars */}
        {metrics && (
          <div className="bg-zinc-900 rounded-2xl ring-1 ring-white/[0.06] p-6 mb-5">
            <h2 className="text-base font-bold mb-6 text-white">
              Las 7 métricas
            </h2>
            <div className="space-y-4">
              {Object.entries(METRIC_META).map(([code, meta]) => {
                const value = metrics[code as keyof typeof metrics] ?? 0;
                const mColor = getScoreColor(value);
                const pct = Math.max(0, Math.min(100, (value / 10) * 100));
                return (
                  <div key={code}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`${SCORE_TEXT[mColor]} text-sm font-black tabular-nums w-7 flex-shrink-0`}
                        >
                          {value.toFixed(1)}
                        </span>
                        <span className="text-sm font-semibold text-white truncate">
                          {meta.label}
                        </span>
                        {realMetrics.includes(code as RealMetric) ? (
                          <span className="text-[0.6rem] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md uppercase tracking-wide flex-shrink-0">
                            Dato real
                          </span>
                        ) : (
                          <span className="text-[0.6rem] text-zinc-300 bg-zinc-800/60 px-1.5 py-0.5 rounded-md uppercase tracking-wide flex-shrink-0">
                            Sin datos aún
                          </span>
                        )}
                      </div>
                      <span className="text-[0.65rem] text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded-md tabular-nums flex-shrink-0 ml-2">
                        {(meta.weight * 100).toFixed(0)}%
                      </span>
                    </div>
                    {/* Animated progress bar via CSS transition */}
                    <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full ${SCORE_BAR_COLOR[mColor]} transition-all duration-700 ease-out`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[0.65rem] text-zinc-300 mt-1">
                      {meta.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legislative bills */}
        {bills.length > 0 && (
          <div className="bg-zinc-900 rounded-2xl ring-1 ring-white/[0.06] p-6 mb-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">
                Proyectos de ley
              </h2>
              <span className="text-[0.7rem] text-zinc-500 bg-zinc-800 px-2.5 py-1 rounded-lg tabular-nums">
                {bills.length} proyectos
              </span>
            </div>
            <div className="space-y-2.5">
              {bills.map((bill) => (
                <div
                  key={bill.expediente}
                  className="bg-zinc-800/40 rounded-xl p-4 ring-1 ring-white/[0.04] hover:bg-zinc-800/70 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Meta row */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span
                          className={`text-[0.65rem] font-semibold px-2 py-0.5 rounded-full ring-1 ${BILL_STATUS_COLOR[bill.status]}`}
                        >
                          {BILL_STATUS_LABEL[bill.status]}
                        </span>
                        <span className="text-[0.65rem] font-mono text-zinc-300">
                          Exp. {bill.expediente}
                        </span>
                        {bill.approvedAt && (
                          <span className="text-[0.65rem] text-zinc-300">
                            {new Date(bill.approvedAt).toLocaleDateString(
                              "es-CR",
                              { month: "short", year: "numeric" },
                            )}
                          </span>
                        )}
                      </div>
                      {/* Title */}
                      <p className="text-sm font-semibold text-white leading-snug">
                        {bill.title}
                      </p>
                      {/* Summary */}
                      {bill.summary && (
                        <p className="text-xs text-zinc-500 leading-relaxed mt-1.5">
                          {bill.summary}
                        </p>
                      )}
                      {/* Coauthors */}
                      {bill.coauthors && bill.coauthors.length > 0 && (
                        <p className="text-[0.65rem] text-zinc-300 mt-2">
                          Co-autores: {bill.coauthors.join(", ")}
                        </p>
                      )}
                    </div>
                    {bill.publicUrl && (
                      <a
                        href={bill.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-zinc-600 hover:text-emerald-400 transition-colors mt-0.5"
                        title="Ver expediente en Asamblea Legislativa"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                          />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw data audit */}
        {rawData && (
          <div className="bg-zinc-900 rounded-2xl ring-1 ring-white/[0.06] p-6 mb-5">
            <h2 className="text-base font-bold mb-4 text-white">
              Datos crudos de auditoría
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                {
                  label: "Sesiones plenario",
                  value: `${rawData.sesionesAsistidas ?? "—"} / ${rawData.sesionesTotales ?? "—"}`,
                },
                {
                  label: "Sesiones comisión",
                  value: `${rawData.comisionesAsistidas ?? "—"} / ${rawData.comisionesTotales ?? "—"}`,
                },
                {
                  label: "Permisos",
                  value: `${rawData.permisos ?? "—"} / ${rawData.permisosTotales ?? "—"}`,
                },
                {
                  label: "Votaciones",
                  value: `${rawData.votacionesAsistidas ?? "—"} / ${rawData.votacionesTotales ?? "—"}`,
                },
                {
                  label: "Proyectos presentados",
                  value: String(rawData.proyectosPresentados ?? "—"),
                },
                {
                  label: "Proyectos aprobados",
                  value: String(rawData.proyectosAprobados ?? "—"),
                },
                {
                  label: "Viajes oficiales",
                  value: String(rawData.viajesOficiales ?? "—"),
                },
                {
                  label: "Noticias positivas",
                  value: String(rawData.medPos ?? "—"),
                },
                {
                  label: "Noticias negativas",
                  value: String(rawData.medNeg ?? "—"),
                },
                {
                  label: "Noticias neutras",
                  value: String(rawData.medNeu ?? "—"),
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-zinc-800/60 rounded-xl p-3 ring-1 ring-white/[0.04]"
                >
                  <p className="text-[0.65rem] text-zinc-300 mb-1">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Period history */}
        {allPeriods.length > 1 && (
          <div className="bg-zinc-900 rounded-2xl ring-1 ring-white/[0.06] p-6">
            <h2 className="text-base font-bold mb-4 text-white">
              Historial de períodos
            </h2>
            <div className="space-y-2">
              {allPeriods.map((period) => (
                <div
                  key={period.id}
                  className="flex items-center justify-between bg-zinc-800/60 rounded-xl px-4 py-3 ring-1 ring-white/[0.04]"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {new Date(period.startDate).getFullYear()} –{" "}
                      {new Date(period.endDate).getFullYear()}
                    </p>
                    <p className="text-xs text-zinc-300">{period.party}</p>
                  </div>
                  {period.score && (
                    <span
                      className={`${SCORE_TEXT[getScoreColor(period.score.overall)]} text-lg font-black tabular-nums`}
                    >
                      {period.score.overall.toFixed(1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 border-t border-white/[0.04] py-8">
        <div className="max-w-5xl mx-auto px-5 text-zinc-400 text-xs">
          <p>
            Datos: Asamblea Legislativa Open Data · Delfino.cr · Google News
          </p>
        </div>
      </footer>
    </div>
  );
}
