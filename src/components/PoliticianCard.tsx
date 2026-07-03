"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { PoliticianCard as PoliticianCardType, ScoreSnapshot } from "@/types";
import { TrendBadge } from "./TrendBadge";
import { Sparkline } from "./Sparkline";
import { getScoreColor } from "@/lib/scoreCalculator";

interface Props {
  politician: PoliticianCardType;
  rank?: number;
  snapshots?: ScoreSnapshot[];
  latestDelta?: number | null;
}

const CARD_METRICS: Array<{ key: keyof PoliticianCardType["metrics"]; label: string }> = [
  { key: "ASI", label: "Asistencia" },
  { key: "PRO", label: "Proyectos" },
  { key: "DEC", label: "Transparencia" },
  { key: "GAS", label: "Gasto" },
];

const HERO_GRADIENT: Record<string, string> = {
  gold:   "from-amber-500/30 via-amber-400/10 to-zinc-900",
  green:  "from-emerald-500/25 via-emerald-400/8 to-zinc-900",
  yellow: "from-yellow-500/25 via-yellow-400/8 to-zinc-900",
  orange: "from-orange-500/25 via-orange-400/8 to-zinc-900",
  red:    "from-rose-600/25 via-rose-500/8 to-zinc-900",
  gray:   "from-zinc-600/20 via-zinc-500/5 to-zinc-900",
};

const RING_COLOR: Record<string, string> = {
  gold:   "ring-amber-400/70",
  green:  "ring-emerald-400/70",
  yellow: "ring-yellow-400/70",
  orange: "ring-orange-500/70",
  red:    "ring-rose-500/70",
  gray:   "ring-zinc-600/60",
};

// Solid badge background — visible sobre la foto
const SCORE_PILL_BG: Record<string, string> = {
  gold:   "bg-amber-500",
  green:  "bg-emerald-500",
  yellow: "bg-yellow-500",
  orange: "bg-orange-500",
  red:    "bg-rose-500",
  gray:   "bg-zinc-600",
};

const SCORE_TEXT: Record<string, string> = {
  gold:   "text-amber-400",
  green:  "text-emerald-400",
  yellow: "text-yellow-400",
  orange: "text-orange-400",
  red:    "text-rose-400",
  gray:   "text-zinc-400",
};

const HOVER_SHADOW: Record<string, string> = {
  gold:   "group-hover:shadow-amber-500/10",
  green:  "group-hover:shadow-emerald-500/10",
  yellow: "group-hover:shadow-yellow-500/10",
  orange: "group-hover:shadow-orange-500/10",
  red:    "group-hover:shadow-rose-500/10",
  gray:   "group-hover:shadow-zinc-500/5",
};

export function PoliticianCard({ politician, rank, snapshots = [], latestDelta = null }: Props) {
  const color = getScoreColor(politician.overall);
  const [imgError, setImgError] = useState(false);

  return (
    <Link href={`/diputados/${politician.id}`} className="block group">
      <div
        className={`
          relative bg-zinc-900 rounded-2xl overflow-hidden
          ring-1 ring-white/[0.06]
          transition-all duration-200 ease-out
          hover:-translate-y-1.5 hover:shadow-2xl ${HOVER_SHADOW[color]}
          hover:ring-white/[0.10]
        `}
      >
        {/* ── Franja de color ── */}
        <div className={`relative h-[3.75rem] bg-gradient-to-b ${HERO_GRADIENT[color]}`}>
          {rank && (
            <span className="absolute top-2.5 left-3 text-[0.6rem] font-bold text-white/25 tabular-nums">
              #{rank}
            </span>
          )}
          {snapshots.length >= 2 && (
            <div className="absolute bottom-2 right-3 opacity-40 group-hover:opacity-70 transition-opacity">
              <Sparkline snapshots={snapshots} width={52} height={22} />
            </div>
          )}
        </div>

        {/* ── Foto + score badge ── */}
        <div className="flex justify-center -mt-9 relative z-10">
          <div className="relative">
            {/* Foto */}
            <div
              className={`
                w-[76px] h-[76px] rounded-full overflow-hidden
                ring-[2.5px] ${RING_COLOR[color]}
                bg-zinc-800 shadow-xl shadow-black/60
              `}
            >
              {politician.photoUrl && !imgError ? (
                <Image
                  src={politician.photoUrl}
                  alt={politician.fullName}
                  width={76}
                  height={76}
                  className="object-cover object-top w-full h-full"
                  unoptimized
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[1.6rem] font-black text-zinc-400 select-none">
                  {politician.fullName.charAt(0)}
                </div>
              )}
            </div>

            {/* Score badge — TOP-LEFT, estilo SofaScore */}
            <div
              className={`
                absolute -top-2 -left-2.5
                ${SCORE_PILL_BG[color]}
                rounded-full px-1.5 py-[0.2rem]
                flex items-center gap-0.5
                shadow-lg ring-1 ring-black/20
                whitespace-nowrap
              `}
            >
              <span className="text-[0.75rem] font-black tabular-nums leading-none text-white">
                {politician.overall.toFixed(1)}
              </span>
              {latestDelta !== null && Math.abs(latestDelta) >= 0.05 && (
                <TrendBadge delta={latestDelta} size="xs" showValue={false} />
              )}
            </div>
          </div>
        </div>

        {/* ── Nombre + partido + provincia ── */}
        <div className="px-3 pt-4 pb-2.5 text-center">
          <h3 className="text-white font-bold text-[0.82rem] leading-tight line-clamp-2 min-h-[2.5rem] flex items-center justify-center">
            {politician.fullName}
          </h3>
          <p className="text-zinc-600 text-[0.6rem] mt-0.5 truncate leading-tight">
            {politician.party}
          </p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <svg className="w-2 h-2 text-zinc-700 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span className="text-zinc-700 text-[0.6rem]">{politician.province}</span>
            {!politician.active && (
              <span className="text-[0.55rem] bg-zinc-800/80 text-zinc-600 px-1.5 py-0.5 rounded-full border border-zinc-700/40">
                Histórico
              </span>
            )}
          </div>
        </div>

        {/* ── Divisor ── */}
        <div className="mx-3 h-px bg-white/[0.04]" />

        {/* ── Métricas 2×2 ── */}
        <div className="px-3.5 py-2.5 grid grid-cols-2 gap-x-2 gap-y-1.5">
          {CARD_METRICS.map(({ key, label }) => {
            const val = politician.metrics?.[key] ?? 0;
            const mColor = getScoreColor(val);
            return (
              <div key={key} className="flex items-center justify-between gap-1">
                <span className="text-zinc-700 text-[0.58rem] uppercase tracking-wider truncate">
                  {label}
                </span>
                <span className={`${SCORE_TEXT[mColor]} text-[0.78rem] font-black tabular-nums leading-none`}>
                  {val.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}
