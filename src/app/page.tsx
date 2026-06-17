export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PoliticianCard } from "@/components/PoliticianCard";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import { PoliticianCard as PoliticianCardType, ScoreSnapshot } from "@/types";

interface HomeProps {
  searchParams: Promise<{
    q?: string;
    provincia?: string;
    sort?: string;
    page?: string;
  }>;
}

interface PoliticianWithTrend {
  card: PoliticianCardType;
  snapshots: ScoreSnapshot[];
  latestDelta: number | null;
}

async function getPoliticians(
  q: string,
  provincia: string,
  sort: string
): Promise<PoliticianWithTrend[]> {
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

    // Delta del snapshot más reciente
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
}

export default async function Home({ searchParams }: HomeProps) {
  const { q = "", provincia = "", sort = "overall_desc" } = await searchParams;
  const politicians = await getPoliticians(q, provincia, sort);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl font-black text-white">
              Diputado<span className="text-blue-400">Score</span>
            </span>
            <span className="text-xs text-gray-500 hidden sm:block">Costa Rica</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-gray-400">
            <Link href="/" className="hover:text-white transition-colors font-medium text-white">
              Diputados
            </Link>
            <Link href="/rankings" className="hover:text-white transition-colors">
              Rankings
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black mb-3">
            ¿Cuánto trabaja tu{" "}
            <span className="text-blue-400">diputado</span>?
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
            Calificaciones basadas en datos públicos reales — asistencia, proyectos, gasto y más.
            <br className="hidden sm:block" />
            Si entendés el 7.8 de Keylor, entendés el score de tu diputado.
          </p>
        </div>

        {/* Búsqueda y filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="flex-1">
            <Suspense>
              <SearchBar />
            </Suspense>
          </div>
          <Suspense>
            <FilterBar />
          </Suspense>
        </div>

        {/* Contador + leyenda de tendencias */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-500 text-sm">
            {politicians.length} diputados
            {q && ` · "${q}"`}
            {provincia && ` · ${provincia}`}
          </p>
          {politicians.some((p) => p.latestDelta !== null) && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1 text-emerald-400">▲ subió</span>
              <span className="flex items-center gap-1 text-red-400">▼ bajó</span>
              <span className="text-gray-600">vs ayer</span>
            </div>
          )}
        </div>

        {/* Grid de tarjetas */}
        {politicians.length === 0 ? (
          <div className="text-center py-24 text-gray-600">
            <p className="text-lg">No se encontraron diputados</p>
            <p className="text-sm mt-2">Ejecutá <code className="bg-gray-800 px-1.5 py-0.5 rounded">npx tsx src/scripts/ingest.ts</code> para cargar datos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

      <footer className="mt-16 border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-600 text-sm">
          <p>Datos: Asamblea Legislativa Open Data · CGR · Delfino.cr</p>
          <p className="mt-1">DiputadoScore no es afiliado a ningún partido político.</p>
        </div>
      </footer>
    </div>
  );
}
