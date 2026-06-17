export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ScoreBadge } from "@/components/ScoreBadge";
import { getScoreColor, SCORE_BORDER_CLASSES } from "@/lib/scoreCalculator";

export default async function RankingsPage() {
  const scores = await prisma.score.findMany({
    include: {
      period: {
        include: { politician: true },
      },
    },
    orderBy: { overall: "desc" },
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-black">
            Diputado<span className="text-blue-400">Score</span>
          </Link>
          <nav className="flex gap-4 text-sm text-gray-400">
            <Link href="/" className="hover:text-white transition-colors">Diputados</Link>
            <Link href="/rankings" className="text-white font-medium">Rankings</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black mb-2">Rankings 2026–2030</h1>
        <p className="text-gray-400 text-sm mb-8">Diputados ordenados de mejor a peor score general</p>

        <div className="space-y-2">
          {scores.map((s, i) => {
            const color = getScoreColor(s.overall);
            return (
              <Link
                key={s.id}
                href={`/diputados/${s.period.politician.id}`}
                className={`
                  flex items-center gap-4 bg-gray-900 rounded-xl px-4 py-3
                  border border-gray-800 hover:border-gray-600
                  transition-all hover:scale-[1.005] group
                `}
              >
                {/* Rank */}
                <span
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                    ${i === 0 ? "bg-yellow-400 text-yellow-900" : i === 1 ? "bg-gray-300 text-gray-800" : i === 2 ? "bg-orange-400 text-orange-900" : "bg-gray-800 text-gray-400"}
                  `}
                >
                  {i + 1}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                    {s.period.politician.fullName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {s.period.politician.party} · {s.period.politician.province}
                  </p>
                </div>

                {/* Mini stats */}
                <div className="hidden sm:flex gap-4 text-xs text-gray-500">
                  <span title="Asistencia">ASI {s.ASI.toFixed(1)}</span>
                  <span title="Proyectos">PRO {s.PRO.toFixed(1)}</span>
                  <span title="Declaración">DEC {s.DEC.toFixed(0)}</span>
                </div>

                {/* Score */}
                <ScoreBadge score={s.overall} size="md" />
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
