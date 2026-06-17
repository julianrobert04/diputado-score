export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ScoreBadge, ScoreBar } from "@/components/ScoreBadge";
import { TrendBadge } from "@/components/TrendBadge";
import { SparklineCard } from "@/components/Sparkline";
import { METRIC_META, DIMENSION_META, ScoreSnapshot } from "@/types";
import { getScoreColor, SCORE_BORDER_CLASSES } from "@/lib/scoreCalculator";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DiputadoPage({ params }: Props) {
  const { id } = await params;

  // Snapshots de los últimos 90 días para el gráfico
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const politician = await prisma.politician.findUnique({
    where: { id },
    include: {
      periods: {
        orderBy: { startDate: "desc" },
        include: {
          score: {
            include: {
              snapshots: {
                where: { takenAt: { gte: since } },
                orderBy: { takenAt: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!politician) notFound();

  const latestPeriod = politician.periods[0];
  const score = latestPeriod?.score;
  const overall = score?.overall ?? 0;
  const color = getScoreColor(overall);

  const metrics = score
    ? {
        ASI: score.ASI, COM: score.COM, PRO: score.PRO, APR: score.APR,
        MOC: score.MOC, DEC: score.DEC, GAS: score.GAS, VIA: score.VIA,
        ASE: score.ASE, VOT: score.VOT, COH: score.COH,
      }
    : null;

  const rawData = score?.rawData as Record<string, unknown> | null;

  // Snapshots para el gráfico de evolución
  const snapshots: ScoreSnapshot[] = (score?.snapshots ?? []).map((s) => ({
    id: s.id,
    takenAt: s.takenAt.toISOString(),
    source: s.source,
    overall: s.overall,
    deltaOverall: s.deltaOverall,
    metrics: {
      ASI: s.ASI, COM: s.COM, PRO: s.PRO, APR: s.APR,
      MOC: s.MOC, DEC: s.DEC, GAS: s.GAS, VIA: s.VIA,
      ASE: s.ASE, VOT: s.VOT, COH: s.COH,
    },
  }));

  const latestSnapshot = snapshots[snapshots.length - 1] ?? null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-black text-white">
              Diputado<span className="text-blue-400">Score</span>
            </span>
          </Link>
          <Link href="/" className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1">
            ← Todos los diputados
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Perfil hero */}
        <div className={`bg-gray-900 rounded-2xl border-2 ${SCORE_BORDER_CLASSES[color]} p-6 mb-8`}>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Foto */}
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-gray-700 flex-shrink-0 bg-gray-800">
              {politician.photoUrl ? (
                <Image src={politician.photoUrl} alt={politician.fullName} fill className="object-cover" sizes="96px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl text-gray-500 font-bold">
                  {politician.fullName.charAt(0)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black">{politician.fullName}</h1>
                  <p className="text-blue-400 font-medium mt-1">{politician.party}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-400">
                    <span>📍 {politician.province}</span>
                    {latestPeriod && (
                      <span>
                        📅 {new Date(latestPeriod.startDate).getFullYear()}–
                        {new Date(latestPeriod.endDate).getFullYear()}
                      </span>
                    )}
                    {!politician.active && (
                      <span className="bg-gray-800 px-2 py-0.5 rounded-full text-gray-500">Histórico</span>
                    )}
                  </div>
                </div>

                {/* Score grande + tendencia */}
                <div className="flex flex-col items-center gap-1.5">
                  <ScoreBadge score={overall} size="xl" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Overall</span>
                    {latestSnapshot?.deltaOverall !== undefined && (
                      <TrendBadge delta={latestSnapshot.deltaOverall} size="sm" />
                    )}
                  </div>
                  {latestSnapshot && (
                    <span className="text-xs text-gray-600">
                      {new Date(latestSnapshot.takenAt).toLocaleDateString("es-CR", {
                        day: "numeric", month: "short",
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico de evolución del score */}
        <div className="mb-8">
          <SparklineCard snapshots={snapshots} title="Evolución del score (últimos 90 días)" />
        </div>

        {/* Dimensiones */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
            {Object.entries(DIMENSION_META).map(([key, dim]) => {
              const dimScore =
                dim.metrics.reduce((sum, m) => sum + (metrics[m] ?? 0), 0) / dim.metrics.length;
              return (
                <div key={key} className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
                  <p className="text-xs text-gray-500 mb-2">{dim.label}</p>
                  <ScoreBadge score={dimScore} size="md" className="mx-auto" />
                  <p className="text-xs text-gray-600 mt-1">{(dim.weight * 100).toFixed(0)}% del score</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Las 11 métricas completas */}
        {metrics && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
            <h2 className="text-lg font-bold mb-5">Las 11 métricas</h2>
            <div className="space-y-4">
              {Object.entries(METRIC_META).map(([code, meta]) => {
                const value = metrics[code as keyof typeof metrics];
                const rd = rawData;
                return (
                  <div key={code} className="flex gap-4 items-start">
                    {/* Score badge */}
                    <ScoreBadge score={value} size="sm" className="flex-shrink-0 mt-0.5" />

                    {/* Info + barra */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{meta.label}</span>
                        <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
                          {(meta.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                      <ScoreBar score={value} label="" />
                      <p className="text-xs text-gray-500 mt-1">{meta.description}</p>
                      <p className="text-xs text-blue-500 mt-0.5">Fuente: {meta.source}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Datos crudos */}
        {rawData && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
            <h2 className="text-lg font-bold mb-4">Datos crudos de auditoría</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Sesiones asistidas", value: `${rawData.sesionesAsistidas ?? "—"} / ${rawData.sesionesTotales ?? "—"}` },
                { label: "Votaciones", value: `${rawData.votacionesParticipadas ?? "—"} / ${rawData.votacionesTotales ?? "—"}` },
                { label: "Proyectos presentados", value: String(rawData.proyectosPresentados ?? "—") },
                { label: "Proyectos aprobados", value: String(rawData.proyectosAprobados ?? "—") },
                { label: "Mociones", value: String(rawData.mociones ?? "—") },
                { label: "Comisiones", value: `${rawData.comisionesAsistidas ?? "—"} / ${rawData.comisionesTotales ?? "—"}` },
                { label: "Declaración bienes", value: String(rawData.declaracionEstado ?? "—").replace("_", " ") },
                { label: "Gasto representación", value: rawData.gastoRepresentacion ? `₡${Number(rawData.gastoRepresentacion).toLocaleString("es-CR")}` : "—" },
                { label: "Viajes oficiales", value: String(rawData.viajesOficiales ?? "—") },
                { label: "Asesores", value: String(rawData.asesoresCount ?? "—") },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Historial de períodos */}
        {politician.periods.length > 1 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-lg font-bold mb-4">Historial de períodos</h2>
            <div className="space-y-3">
              {politician.periods.map((period) => (
                <div key={period.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(period.startDate).getFullYear()} – {new Date(period.endDate).getFullYear()}
                    </p>
                    <p className="text-xs text-gray-500">{period.party}</p>
                  </div>
                  {period.score && <ScoreBadge score={period.score.overall} size="md" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
