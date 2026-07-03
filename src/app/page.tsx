export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PoliticianCard } from "@/components/PoliticianCard";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import { PoliticianCard as PoliticianCardType, ScoreSnapshot } from "@/types";
import { getMockPoliticians, PoliticianWithTrend } from "@/lib/mockData";

interface HomeProps {
  searchParams: Promise<{
    q?: string;
    provincia?: string;
    sort?: string;
    page?: string;
  }>;
}

async function getPoliticians(
  q: string,
  provincia: string,
  sort: string
): Promise<PoliticianWithTrend[]> {
  try {
    // Últimos 30 días para sparklines
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const politicians = await prisma.politician.findMany({
      where: {
        type: "diputado",
        ...(q && { fullName: { contains: q, mode: "insensitive" } }),
        ...(provincia && { province: { contains: provincia, mode: "insensitive" } }),
      },
      include: {
        periods: {
          orderBy: { startDate: "desc" },
          take: 1,
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

    // Si no hay datos en la DB todavía, caer al mock
    if (politicians.length === 0) return getMockPoliticians(q, provincia, sort);

    const results: PoliticianWithTrend[] = politicians.map((p) => {
      const period = p.periods[0];
      const score = period?.score;
      const rawSnapshots = score?.snapshots ?? [];

      const snapshots: ScoreSnapshot[] = rawSnapshots.map((s) => ({
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

      const latestDelta = rawSnapshots.length > 0
        ? rawSnapshots[rawSnapshots.length - 1].deltaOverall
        : null;

      const card: PoliticianCardType = {
        id: p.id,
        fullName: p.fullName,
        type: p.type as PoliticianCardType["type"],
        party: p.party,
        province: p.province,
        photoUrl: p.photoUrl ?? undefined,
        active: p.active,
        overall: score?.overall ?? 0,
        metrics: score
          ? { ASI: score.ASI, COM: score.COM, PRO: score.PRO, APR: score.APR, MOC: score.MOC, DEC: score.DEC, GAS: score.GAS, VIA: score.VIA, ASE: score.ASE, VOT: score.VOT, COH: score.COH }
          : { ASI: 0, COM: 0, PRO: 0, APR: 0, MOC: 0, DEC: 0, GAS: 0, VIA: 0, ASE: 0, VOT: 0, COH: 0 },
        period: period
          ? { startDate: period.startDate.toISOString(), endDate: period.endDate.toISOString() }
          : { startDate: "", endDate: "" },
      };

      return { card, snapshots, latestDelta };
    });

    return results.sort((a, b) => {
      if (sort === "overall_asc") return a.card.overall - b.card.overall;
      if (sort === "name_asc") return a.card.fullName.localeCompare(b.card.fullName);
      if (sort === "name_desc") return b.card.fullName.localeCompare(a.card.fullName);
      return b.card.overall - a.card.overall;
    });
  } catch {
    // Sin DB (desarrollo local) — usar datos mock
    return getMockPoliticians(q, provincia, sort);
  }
}

export default async function Home({ searchParams }: HomeProps) {
  const { q = "", provincia = "", sort = "overall_desc" } = await searchParams;
  const politicians = await getPoliticians(q, provincia, sort);

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
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-12">

        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-[0.7rem] font-semibold tracking-wide uppercase">Datos públicos · Asamblea Legislativa</span>
          </div>
          <h1 className="text-4xl sm:text-[3.25rem] font-black tracking-tight leading-[1.05] mb-4">
            ¿Cuánto trabaja<br className="hidden sm:block" />
            {" "}tu <span className="text-emerald-400">diputado</span>?
          </h1>
          <p className="text-zinc-500 text-base max-w-lg leading-relaxed">
            Scores del 1 al 10 basados en asistencia, proyectos de ley, gasto y transparencia.
            Como el rating de Keylor — pero para la Asamblea.
          </p>
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
              Corré <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-500">npm run ingest</code> para cargar datos
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {politicians.map(({ card, snapshots, latestDelta }, i) => (
              <PoliticianCard
                key={card.id}
                politician={card}
                rank={sort.startsWith("overall") ? i + 1 : undefined}
                snapshots={snapshots}
                latestDelta={latestDelta}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="mt-20 border-t border-white/[0.04] py-8">
        <div className="max-w-7xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-zinc-700 text-xs">
          <p>Datos: Asamblea Legislativa Open Data · CGR · Delfino.cr</p>
          <p>DiputadoScore no es afiliado a ningún partido político.</p>
        </div>
      </footer>
    </div>
  );
}
