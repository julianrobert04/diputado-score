export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getScoreColor } from "@/lib/scoreCalculator";
import { getMockPoliticians } from "@/lib/mockData";

interface RankingRow {
  id: string;
  fullName: string;
  party: string;
  province: string;
  overall: number;
  ASI: number;
  PRO: number;
  DEC: number;
}

async function getRankings(): Promise<RankingRow[]> {
  try {
    const scores = await prisma.score.findMany({
      include: { period: { include: { politician: true } } },
      orderBy: { overall: "desc" },
    });
    if (scores.length === 0) throw new Error("empty");
    return scores.map((s) => ({
      id: s.period.politician.id,
      fullName: s.period.politician.fullName,
      party: s.period.politician.party,
      province: s.period.politician.province,
      overall: s.overall,
      ASI: s.ASI,
      PRO: s.PRO,
      DEC: s.DEC,
    }));
  } catch {
    return getMockPoliticians().map(({ card }) => ({
      id: card.id,
      fullName: card.fullName,
      party: card.party,
      province: card.province,
      overall: card.overall,
      ASI: card.metrics.ASI,
      PRO: card.metrics.PRO,
      DEC: card.metrics.DEC,
    }));
  }
}

const SCORE_TEXT: Record<string, string> = {
  gold:   "text-amber-400",
  green:  "text-emerald-400",
  yellow: "text-yellow-400",
  orange: "text-orange-400",
  red:    "text-rose-400",
  gray:   "text-zinc-400",
};

const RANK_STYLES = [
  "bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30",
  "bg-zinc-400/10 text-zinc-300 ring-1 ring-zinc-400/20",
  "bg-orange-400/10 text-orange-400 ring-1 ring-orange-400/20",
];

export default async function RankingsPage() {
  const scores = await getRankings();

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0c0c0e]/80 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-[1.05rem] font-black tracking-tight text-white">
              Diputado<span className="text-emerald-400">Score</span>
            </span>
            <span className="hidden sm:inline-flex items-center text-[0.65rem] font-semibold text-zinc-600 bg-zinc-800/60 px-2 py-0.5 rounded-full border border-white/[0.05] tracking-wide uppercase">
              Costa Rica
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/" className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors">
              Diputados
            </Link>
            <Link href="/rankings" className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-white/[0.07] transition-colors">
              Rankings
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-2">
            Rankings <span className="text-emerald-400">2026–2030</span>
          </h1>
          <p className="text-zinc-500 text-sm">Diputados ordenados de mejor a peor score general</p>
        </div>

        <div className="space-y-1.5">
          {scores.map((s, i) => {
            const color = getScoreColor(s.overall);
            return (
              <Link
                key={s.id}
                href={`/diputados/${s.id}`}
                className="flex items-center gap-4 bg-zinc-900 rounded-xl px-4 py-3 ring-1 ring-white/[0.05] hover:ring-white/[0.10] hover:-translate-y-px transition-all duration-150 group"
              >
                {/* Rank */}
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${RANK_STYLES[i] ?? "bg-zinc-800/60 text-zinc-500"}`}>
                  {i + 1}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm group-hover:text-emerald-400 transition-colors truncate">
                    {s.fullName}
                  </p>
                  <p className="text-[0.7rem] text-zinc-600 truncate mt-0.5">
                    {s.party} · {s.province}
                  </p>
                </div>

                {/* Mini stats */}
                <div className="hidden sm:flex gap-5 text-[0.7rem] text-zinc-600">
                  <div className="text-center">
                    <div className="text-zinc-400 font-medium tabular-nums">{s.ASI.toFixed(1)}</div>
                    <div>ASI</div>
                  </div>
                  <div className="text-center">
                    <div className="text-zinc-400 font-medium tabular-nums">{s.PRO.toFixed(1)}</div>
                    <div>PRO</div>
                  </div>
                  <div className="text-center">
                    <div className="text-zinc-400 font-medium tabular-nums">{s.DEC.toFixed(0)}</div>
                    <div>DEC</div>
                  </div>
                </div>

                {/* Score */}
                <div className={`${SCORE_TEXT[color]} text-lg font-black tabular-nums w-10 text-right`}>
                  {s.overall.toFixed(1)}
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      <footer className="mt-20 border-t border-white/[0.04] py-8">
        <div className="max-w-4xl mx-auto px-5 text-zinc-700 text-xs">
          <p>Datos: Asamblea Legislativa Open Data · CGR · Delfino.cr</p>
        </div>
      </footer>
    </div>
  );
}
