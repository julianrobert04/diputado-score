export const dynamic = "force-dynamic";

import Link from "next/link";
import { RankingAvatar } from "@/components/RankingAvatar";
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
  MED: number;
  photoUrl: string;
}

async function getRankings(): Promise<RankingRow[]> {
  return getMockPoliticians().map(({ card }) => ({
    id: card.id,
    fullName: card.fullName,
    party: card.party,
    province: card.province,
    overall: card.overall,
    ASI: card.metrics.ASI,
    PRO: card.metrics.PRO,
    MED: card.metrics.MED,
    photoUrl: card.photoUrl ?? "",
  }));
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

const PARTY_ABBR: Record<string, string> = {
  "Partido Pueblo Soberano":             "PPSO",
  "Partido Liberación Nacional":         "PLN",
  "Frente Amplio":                       "FA",
  "Coalición Agenda Ciudadana":          "CAC",
  "Partido Unidad Social Cristiana":     "PUSC",
};

function partyAbbr(full: string): string {
  return PARTY_ABBR[full] ?? full.slice(0, 4).toUpperCase();
}

function computePartyStats(scores: RankingRow[]) {
  const map = new Map<string, { sum: number; count: number }>();
  for (const s of scores) {
    const existing = map.get(s.party) ?? { sum: 0, count: 0 };
    map.set(s.party, { sum: existing.sum + s.overall, count: existing.count + 1 });
  }
  return Array.from(map.entries())
    .map(([party, { sum, count }]) => ({
      party,
      abbr: partyAbbr(party),
      avg: sum / count,
      count,
    }))
    .sort((a, b) => b.avg - a.avg);
}

interface PodiumCardProps {
  rank: 1 | 2 | 3;
  row: RankingRow;
}

const MEDAL_RING = {
  1: "ring-[3px] ring-amber-400/70",
  2: "ring-[2.5px] ring-zinc-400/50",
  3: "ring-[2.5px] ring-orange-400/50",
};

const MEDAL_LABEL: Record<number, string> = { 1: "1°", 2: "2°", 3: "3°" };

const MEDAL_LABEL_COLOR: Record<number, string> = {
  1: "text-amber-400",
  2: "text-zinc-300",
  3: "text-orange-400",
};

const PODIUM_HEIGHT: Record<number, string> = {
  1: "pt-0",
  2: "pt-8",
  3: "pt-14",
};

function PodiumCard({ rank, row }: PodiumCardProps) {
  const color = getScoreColor(row.overall);
  return (
    <Link
      href={`/diputados/${row.id}`}
      className={`flex flex-col items-center gap-2 ${PODIUM_HEIGHT[rank]} group`}
    >
      <span className={`text-xs font-black tabular-nums ${MEDAL_LABEL_COLOR[rank]}`}>
        {MEDAL_LABEL[rank]}
      </span>
      <RankingAvatar
        photoUrl={row.photoUrl}
        fullName={row.fullName}
        size={rank === 1 ? 80 : 64}
        ringClass={MEDAL_RING[rank]}
      />
      <div className="text-center max-w-[110px]">
        <p className="text-white font-bold text-[0.75rem] leading-tight line-clamp-2 group-hover:text-emerald-400 transition-colors">
          {row.fullName}
        </p>
        <p className="text-zinc-600 text-[0.6rem] mt-0.5 truncate">{partyAbbr(row.party)}</p>
        <p className={`${SCORE_TEXT[color]} text-xl font-black tabular-nums mt-0.5`}>
          {row.overall.toFixed(1)}
        </p>
      </div>
    </Link>
  );
}

export default async function RankingsPage() {
  const scores = await getRankings();
  const partyStats = computePartyStats(scores);

  const [first, second, third, ...rest] = scores;

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

        {/* Podio top 3 */}
        {first && second && third && (
          <div className="mb-8 bg-zinc-900 rounded-2xl ring-1 ring-white/[0.06] px-6 pt-6 pb-8">
            {/* Desktop: 2-1-3 | Mobile: 1-2-3 */}
            <div className="hidden sm:flex justify-center items-end gap-10">
              <PodiumCard rank={2} row={second} />
              <PodiumCard rank={1} row={first} />
              <PodiumCard rank={3} row={third} />
            </div>
            <div className="flex sm:hidden flex-col items-center gap-6">
              <PodiumCard rank={1} row={first} />
              <PodiumCard rank={2} row={second} />
              <PodiumCard rank={3} row={third} />
            </div>
          </div>
        )}

        {/* Stats por partido */}
        <div className="mb-8 bg-zinc-900 rounded-2xl ring-1 ring-white/[0.06] px-5 py-4">
          <p className="text-[0.65rem] font-semibold text-zinc-600 uppercase tracking-wider mb-3">
            Promedio por partido
          </p>
          <div className="flex flex-wrap gap-3">
            {partyStats.map(({ party, abbr, avg, count }) => {
              const color = getScoreColor(avg);
              return (
                <div
                  key={party}
                  className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-2 ring-1 ring-white/[0.04]"
                >
                  <span className="text-[0.7rem] font-bold text-zinc-300">{abbr}</span>
                  <span className={`${SCORE_TEXT[color]} text-sm font-black tabular-nums`}>
                    {avg.toFixed(1)}
                  </span>
                  <span className="text-zinc-700 text-[0.6rem] tabular-nums">{count} dip.</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lista desde puesto 4 */}
        <div className="space-y-1.5">
          {rest.map((s, i) => {
            const rank = i + 4;
            const color = getScoreColor(s.overall);
            const barWidth = Math.round((s.overall / 10) * 100);
            return (
              <Link
                key={s.id}
                href={`/diputados/${s.id}`}
                className="flex items-center gap-3 bg-zinc-900 rounded-xl px-4 py-3 ring-1 ring-white/[0.05] hover:ring-white/[0.10] hover:-translate-y-px transition-all duration-150 group"
              >
                {/* Rank */}
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${RANK_STYLES[rank - 1] ?? "bg-zinc-800/60 text-zinc-500"}`}>
                  {rank}
                </span>

                {/* Foto miniatura */}
                <RankingAvatar
                  photoUrl={s.photoUrl}
                  fullName={s.fullName}
                  size={28}
                  ringClass="ring-1 ring-white/10"
                />

                {/* Info con barra */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm group-hover:text-emerald-400 transition-colors truncate">
                    {s.fullName}
                  </p>
                  <p className="text-[0.7rem] text-zinc-600 truncate mt-0.5">
                    {s.party} · {s.province}
                  </p>
                  {/* Barra de score */}
                  <div className="mt-1.5 h-[3px] bg-zinc-800 rounded-full overflow-hidden w-full max-w-[180px]">
                    <div
                      className={`h-full rounded-full ${
                        color === "gold"   ? "bg-amber-400"   :
                        color === "green"  ? "bg-emerald-400" :
                        color === "yellow" ? "bg-yellow-400"  :
                        color === "orange" ? "bg-orange-400"  :
                        color === "red"    ? "bg-rose-400"    :
                        "bg-zinc-500"
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
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
                    <div className="text-zinc-400 font-medium tabular-nums">{s.MED.toFixed(1)}</div>
                    <div>MED</div>
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
          <p>Datos: Asamblea Legislativa Open Data · Delfino.cr · Google News</p>
        </div>
      </footer>
    </div>
  );
}
