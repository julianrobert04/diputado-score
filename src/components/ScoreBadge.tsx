"use client";

import { getScoreColor } from "@/lib/scoreCalculator";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

// Colores sólidos más saturados y modernos
const SCORE_BG: Record<string, string> = {
  gold:   "bg-amber-400 text-amber-950",
  green:  "bg-emerald-400 text-emerald-950",
  yellow: "bg-yellow-400 text-yellow-950",
  orange: "bg-orange-500 text-white",
  red:    "bg-rose-500 text-white",
  gray:   "bg-zinc-600 text-white",
};

const SIZE_CLASSES = {
  sm: "w-8 h-8 text-xs font-black tracking-tight",
  md: "w-11 h-11 text-sm font-black tracking-tight",
  lg: "w-[3.25rem] h-[3.25rem] text-base font-black tracking-tight",
  xl: "w-20 h-20 text-2xl font-black tracking-tight",
};

export function ScoreBadge({ score, size = "md", className = "" }: ScoreBadgeProps) {
  const color = getScoreColor(score);
  return (
    <div
      className={`
        rounded-xl flex items-center justify-center shadow-lg
        ${SIZE_CLASSES[size]}
        ${SCORE_BG[color]}
        ${className}
      `}
    >
      {score > 0 ? score.toFixed(1) : "—"}
    </div>
  );
}

interface ScoreBarProps {
  score: number;
  label: string;
  size?: "sm" | "md";
}

const BAR_COLOR: Record<string, string> = {
  gold:   "bg-amber-400",
  green:  "bg-emerald-400",
  yellow: "bg-yellow-400",
  orange: "bg-orange-500",
  red:    "bg-rose-500",
  gray:   "bg-zinc-500",
};

export function ScoreBar({ score, label, size = "md" }: ScoreBarProps) {
  const color = getScoreColor(score);
  const pct = (score / 10) * 100;

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`
          text-zinc-500 truncate flex-shrink-0
          ${size === "sm" ? "text-[0.68rem] w-[5.5rem]" : "text-xs w-28"}
        `}
      >
        {label}
      </span>
      <div className="flex-1 h-[3px] bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${BAR_COLOR[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`
          font-bold tabular-nums text-zinc-300 flex-shrink-0 text-right
          ${size === "sm" ? "text-[0.7rem] w-5" : "text-xs w-6"}
        `}
      >
        {score > 0 ? score.toFixed(1) : "—"}
      </span>
    </div>
  );
}
