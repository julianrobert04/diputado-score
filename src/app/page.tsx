export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { PoliticianCard } from "@/components/PoliticianCard";
import { RankingAvatar } from "@/components/RankingAvatar";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import { getMockPoliticians, PoliticianWithTrend, REAL_DATA_INFO } from "@/lib/mockData";
import { getScoreColor } from "@/lib/scoreCalculator";

const PARTIDO_SHORT: Record<string, string> = {
  "Partido Pueblo Soberano": "PPSO",
  "Partido Liberación Nacional": "PLN",
  "Frente Amplio": "FA",
  "Coalición Agenda Ciudadana": "CAC",
  "Partido Unidad Social Cristiana": "PUSC",
};

const SCORE_TEXT: Record<string, string> = {
  gold:   "text-amber-400",
  green:  "text-emerald-400",
  yellow: "text-yellow-400",
  orange: "text-orange-400",
  red:    "text-rose-400",
  gray:   "text-zinc-400",
};

const STAT_TILE = "bg-zinc-900 ring-1 ring-white/[0.06] rounded-xl px-4 py-3 hover:ring-white/[0.12] transition-all duration-200";

// Nombres ticos: nombres de pila + dos apellidos → mostrar primer nombre + primer apellido
function shortName(fullName: string): string {
  const parts = fullName.split(" ");
  if (parts.length <= 2) return fullName;
  return `${parts[0]} ${parts[parts.length - 2]}`;
}

interface HomeProps {
  searchParams: Promise<{
    q?: string;
    provincia?: string;
    sort?: string;
    partido?: string;
    page?: string;
  }>;
}

async function getPoliticians(
  q: string,
  provincia: string,
  sort: string
): Promise<PoliticianWithTrend[]> {
  return getMockPoliticians(q, provincia, sort);
}

export default async function Home({ searchParams }: HomeProps) {
  const { q = "", provincia = "", sort = "overall_desc", partido = "" } = await searchParams;
  const allPoliticians = await getPoliticians(q, provincia, sort);
  const politicians = partido
    ? allPoliticians.filter((p) => p.card.party === partido)
    : allPoliticians;

  const avgScore = politicians.length
    ? politicians.reduce((sum, p) => sum + p.card.overall, 0) / politicians.length
    : 0;
  const best = politicians.reduce<PoliticianWithTrend | null>(
    (top, p) => (!top || p.card.overall > top.card.overall ? p : top),
    null
  );
  const partyAvgs = Object.entries(
    politicians.reduce<Record<string, { sum: number; count: number }>>((acc, p) => {
      const party = p.card.party ?? "";
      if (!acc[party]) acc[party] = { sum: 0, count: 0 };
      acc[party].sum += p.card.overall;
      acc[party].count += 1;
      return acc;
    }, {})
  ).map(([name, { sum, count }]) => ({ name, avg: sum / count }));
  const bestParty = partyAvgs.reduce<{ name: string; avg: number } | null>(
    (top, p) => (!top || p.avg > top.avg ? p : top),
    null
  );
  const asistenciaPerfecta = politicians.filter((p) => p.card.metrics.ASI >= 9.95).length;
  const asistenciaPct = politicians.length
    ? Math.round((asistenciaPerfecta / politicians.length) * 100)
    : 0;
  const top3 = [...allPoliticians]
    .sort((a, b) => b.card.overall - a.card.overall)
    .slice(0, 3);
  const MEDAL = ["text-amber-400", "text-zinc-400", "text-orange-400"];

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">

      {/* Header — minimalista, sin ruido */}
      <header className="sticky top-0 z-50 bg-[#0c0c0e]/80 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-[1.05rem] font-black tracking-tight text-white">
              Diputado<span className="text-emerald-400">Score</span>
            </span>
            <span className="hidden sm:inline-flex items-center text-[0.65rem] font-semibold text-zinc-600 bg-zinc-800/60 px-2 py-0.5 rounded-full border border-white/[0.05] tracking-wide uppercase">
              Costa Rica
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/" className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-white/[0.07] transition-colors">
              Diputados
            </Link>
            <Link href="/rankings" className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors">
              Rankings
            </Link>
            <Link href="/metricas" className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors">
              Métricas
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-12">

        {/* Hero */}
        <div className="relative mb-12">
          {/* Glow de fondo */}
          <div
            className="pointer-events-none absolute -inset-x-10 -top-24 h-[420px] opacity-70"
            style={{ background: "radial-gradient(560px 280px at 22% 20%, rgba(16,185,129,0.08), transparent 70%)" }}
          />

          <div className="relative flex flex-col lg:flex-row gap-10 lg:items-center">
            <div className="flex-1 min-w-0">
              {/* Cita apertura */}
              <div className="mb-7 border-l-2 border-emerald-500/40 pl-4">
                <p className="text-zinc-400 text-sm italic leading-relaxed">
                  "Un país que le exige más a un futbolista que a un político<br className="hidden sm:block" /> está condenado a la mediocridad."
                </p>
                <span className="text-zinc-600 text-xs mt-1 block">— Anónimo</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="text-zinc-600 text-[0.7rem]">
                  Actualizado {new Date(REAL_DATA_INFO.updatedAt).toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" })} · datos abiertos de la Asamblea
                </span>
              </div>
              <h1 className="text-3xl sm:text-[2.75rem] font-black tracking-tight leading-[1.1] mb-4">
                Los ticos sabemos más sobre el rendimiento de los futbolistas{" "}
                <span className="text-emerald-400">que el de nuestros diputados.</span>
              </h1>
              <p className="text-zinc-500 text-base max-w-lg leading-relaxed">
                Inspirados en los puntajes con los que se evalúa a los jugadores,
                calificamos el desempeño de cada diputado de la Asamblea Legislativa.
              </p>
            </div>

            {/* Podio Top 3 */}
            {top3.length === 3 && (
              <aside className="hidden lg:block w-[310px] flex-shrink-0">
                <div className="bg-zinc-900/80 backdrop-blur rounded-2xl ring-1 ring-white/[0.06] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-zinc-500 text-[0.65rem] font-semibold uppercase tracking-widest">
                      Top 3 del momento
                    </p>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    {top3.map(({ card }, i) => (
                      <Link
                        key={card.id}
                        href={`/diputados/${card.id}`}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-zinc-800/50 ring-1 ring-white/[0.04] hover:ring-emerald-400/30 hover:bg-zinc-800/80 transition-all group"
                      >
                        <span className={`${MEDAL[i]} text-sm font-black tabular-nums w-4 flex-shrink-0`}>
                          {i + 1}
                        </span>
                        <RankingAvatar
                          photoUrl={card.photoUrl ?? ""}
                          fullName={card.fullName}
                          size={34}
                          ringClass="ring-1 ring-white/10"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-[0.78rem] font-bold truncate group-hover:text-emerald-400 transition-colors">
                            {shortName(card.fullName)}
                          </p>
                          <p className="text-zinc-600 text-[0.62rem] truncate">
                            {PARTIDO_SHORT[card.party] ?? card.party}
                          </p>
                        </div>
                        <span className={`${SCORE_TEXT[getScoreColor(card.overall)]} text-sm font-black tabular-nums`}>
                          {card.overall.toFixed(1)}
                        </span>
                      </Link>
                    ))}
                  </div>
                  <Link
                    href="/rankings"
                    className="mt-4 flex items-center justify-center gap-1.5 text-[0.72rem] font-semibold text-zinc-500 hover:text-emerald-400 transition-colors"
                  >
                    Ver ranking completo
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </aside>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          <div className={STAT_TILE}>
            <p className="text-zinc-600 text-[0.65rem] font-semibold uppercase tracking-widest mb-1">Rating promedio</p>
            <p className={`text-xl font-black ${SCORE_TEXT[getScoreColor(avgScore)]}`}>
              {avgScore.toFixed(1)}
            </p>
          </div>
          <div className={STAT_TILE}>
            <p className="text-zinc-600 text-[0.65rem] font-semibold uppercase tracking-widest mb-1">MVP de la jornada</p>
            {best ? (
              <>
                <p className="text-white text-sm font-bold leading-tight truncate">{shortName(best.card.fullName)}</p>
                <p className="text-zinc-500 text-xs">{best.card.overall.toFixed(1)}</p>
              </>
            ) : <p className="text-zinc-700 text-sm">—</p>}
          </div>
          <div className={STAT_TILE}>
            <p className="text-zinc-600 text-[0.65rem] font-semibold uppercase tracking-widest mb-1">Mejor partido</p>
            {bestParty ? (
              <>
                <p className="text-white text-sm font-bold">{PARTIDO_SHORT[bestParty.name] ?? bestParty.name}</p>
                <p className="text-zinc-500 text-xs">{bestParty.avg.toFixed(1)} prom.</p>
              </>
            ) : <p className="text-zinc-700 text-sm">—</p>}
          </div>
          <div className={STAT_TILE}>
            <p className="text-zinc-600 text-[0.65rem] font-semibold uppercase tracking-widest mb-1">Asistencia perfecta</p>
            <p className="text-xl font-black text-emerald-400">{asistenciaPct}%</p>
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-8">
          <div className="flex-1">
            <Suspense>
              <SearchBar />
            </Suspense>
          </div>
          <Suspense>
            <FilterBar />
          </Suspense>
        </div>

        {/* Count + legend */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-zinc-600 text-xs font-medium tracking-widest uppercase">
            {politicians.length} diputados
            {q && <span className="text-zinc-500 normal-case ml-1.5">· &ldquo;{q}&rdquo;</span>}
            {provincia && <span className="text-zinc-500 normal-case ml-1.5">· {provincia}</span>}
            {partido && <span className="text-zinc-500 normal-case ml-1.5">· {PARTIDO_SHORT[partido] ?? partido}</span>}
          </p>
          {politicians.some((p) => p.latestDelta !== null) && (
            <div className="flex items-center gap-3 text-[0.68rem] text-zinc-600">
              <span className="flex items-center gap-1"><span className="text-emerald-400">▲</span> subió</span>
              <span className="flex items-center gap-1"><span className="text-rose-400">▼</span> bajó</span>
              <span className="text-zinc-700">vs ayer</span>
            </div>
          )}
        </div>

        {/* Grid */}
        {politicians.length === 0 ? (
          <div className="text-center py-32 text-zinc-700">
            <p className="text-base font-medium">No se encontraron diputados</p>
            <p className="text-sm mt-2 text-zinc-800">
              Corré <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-500">npm run ingest:opendata</code> para cargar datos
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {politicians.map(({ card, snapshots, latestDelta }, i) => (
              <div
                key={card.id}
                style={{
                  animation: "fadeInUp 0.35s ease both",
                  animationDelay: `${Math.min(i * 25, 400)}ms`,
                }}
              >
                <PoliticianCard
                  politician={card}
                  rank={sort.startsWith("overall") ? i + 1 : undefined}
                  snapshots={snapshots}
                  latestDelta={latestDelta}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-20 border-t border-white/[0.04] py-8">
        <div className="max-w-7xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-zinc-700 text-xs">
          <p>Datos: Asamblea Legislativa Open Data · Delfino.cr · Google News</p>
          <p>DiputadoScore no es afiliado a ningún partido político.</p>
        </div>
      </footer>
    </div>
  );
}
