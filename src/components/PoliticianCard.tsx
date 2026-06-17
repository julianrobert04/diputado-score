"use client";

import Link from "next/link";
import Image from "next/image";
import { PoliticianCard as PoliticianCardType, ScoreSnapshot } from "@/types";
import { ScoreBadge, ScoreBar } from "./ScoreBadge";
import { TrendBadge } from "./TrendBadge";
import { Sparkline } from "./Sparkline";
import { getScoreColor, SCORE_BORDER_CLASSES } from "@/lib/scoreCalculator";

interface Props {
  politician: PoliticianCardType;
  rank?: number;
  snapshots?: ScoreSnapshot[]; // últimos snapshots para la sparkline
  latestDelta?: number | null;  // delta del snapshot más reciente
}

// Las 5 métricas más visibles en la tarjeta
const CARD_METRICS: Array<{ key: keyof PoliticianCardType["metrics"]; label: string }> = [
  { key: "ASI", label: "Asistencia" },
  { key: "VOT", label: "Votaciones" },
  { key: "PRO", label: "Proyectos" },
  { key: "DEC", label: "Declaración" },
  { key: "GAS", label: "Gasto" },
];

export function PoliticianCard({ politician, rank, snapshots = [], latestDelta = null }: Props) {
  const color = getScoreColor(politician.overall);

  return (
    <Link href={`/diputados/${politician.id}`} className="block group">
      <div
        className={`
          relative bg-gray-900 rounded-xl overflow-hidden
          border-2 transition-all duration-200
          hover:scale-[1.02] hover:shadow-xl hover:shadow-black/40
          ${SCORE_BORDER_CLASSES[color]}
          cursor-pointer
        `}
      >
        {/* Rank badge */}
        {rank && (
          <div className="absolute top-3 left-3 z-10 bg-black/60 text-gray-300 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
            {rank}
          </div>
        )}

        {/* Header con foto y overall */}
        <div className="relative bg-gradient-to-b from-gray-800 to-gray-900 px-4 pt-5 pb-3">
          <div className="flex items-start gap-3">
            {/* Foto */}
            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-700 flex-shrink-0 bg-gray-700">
              {politician.photoUrl ? (
                <Image
                  src={politician.photoUrl}
                  alt={politician.fullName}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-gray-500">
                  {politician.fullName.charAt(0)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">
                {politician.fullName}
              </h3>
              <p className="text-gray-400 text-xs mt-0.5 truncate">{politician.party}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-gray-500 text-xs">📍</span>
                <span className="text-gray-400 text-xs">{politician.province}</span>
                {!politician.active && (
                  <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                    Histórico
                  </span>
                )}
              </div>
            </div>

            {/* Overall score + tendencia */}
            <div className="flex flex-col items-center gap-1">
              <ScoreBadge score={politician.overall} size="lg" />
              {latestDelta !== null && (
                <TrendBadge delta={latestDelta} size="xs" />
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 pb-4 space-y-2 pt-2">
          {CARD_METRICS.map(({ key, label }) => (
            <ScoreBar
              key={key}
              score={politician.metrics?.[key] ?? 0}
              label={label}
              size="sm"
            />
          ))}
        </div>

        {/* Footer — partido chip + sparkline */}
        <div className="px-4 pb-3 flex items-center justify-between gap-2">
          <span className="inline-block text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full truncate">
            {politician.party}
          </span>
          {snapshots.length >= 2 && (
            <Sparkline snapshots={snapshots} width={72} height={24} />
          )}
        </div>
      </div>
    </Link>
  );
}
