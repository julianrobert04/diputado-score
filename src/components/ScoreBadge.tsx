"use client";

import { getScoreColor, SCORE_COLOR_CLASSES, SCORE_BORDER_CLASSES } from "@/lib/scoreCalculator";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "w-8 h-8 text-xs font-bold",
  md: "w-10 h-10 text-sm font-bold",
  lg: "w-14 h-14 text-lg font-bold",
  xl: "w-20 h-20 text-2xl font-extrabold",
};

export function ScoreBadge({ score, size = "md", className = "" }: ScoreBadgeProps) {
  const color = getScoreColor(score);
  return (
    <div
      className={`
        rounded-lg flex items-center justify-center
        ${SIZE_CLASSES[size]}
        ${SCORE_COLOR_CLASSES[color]}
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

export function ScoreBar({ score, label, size = "md" }: ScoreBarProps) {
  const color = getScoreColor(score);
  const pct = (score / 10) * 100;

  const barColorClass: Record<typeof color, string> = {
    gold: "bg-yellow-400",
    green: "bg-emerald-500",
    yellow: "bg-yellow-500",
    orange: "bg-orange-500",
    red: "bg-red-600",
    gray: "bg-gray-400",
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`text-gray-400 ${size === "sm" ? "text-xs w-24" : "text-sm w-32"} truncate`}>{label}</span>
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColorClass[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-bold tabular-nums ${size === "sm" ? "text-xs w-6" : "text-sm w-8"} text-right`}>
        {score > 0 ? score.toFixed(1) : "—"}
      </span>
    </div>
  );
}
