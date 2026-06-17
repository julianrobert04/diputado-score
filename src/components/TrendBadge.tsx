"use client";

/**
 * TrendBadge — muestra la variación del score vs el snapshot anterior.
 * Igual que la flecha verde/roja de SofaScore cuando un jugador sube o baja.
 */

interface TrendBadgeProps {
  delta: number | null; // null = primer dato, sin comparación
  size?: "xs" | "sm" | "md";
  showValue?: boolean;
}

export function TrendBadge({ delta, size = "sm", showValue = true }: TrendBadgeProps) {
  if (delta === null || delta === undefined) {
    return null; // primer snapshot, sin tendencia aún
  }

  const isUp = delta > 0;
  const isDown = delta < 0;
  const isNeutral = delta === 0;

  const sizeClass = {
    xs: "text-xs gap-0.5",
    sm: "text-sm gap-1",
    md: "text-base gap-1",
  }[size];

  const colorClass = isUp
    ? "text-emerald-400"
    : isDown
    ? "text-red-400"
    : "text-gray-500";

  const arrow = isUp ? "▲" : isDown ? "▼" : "—";

  return (
    <span className={`inline-flex items-center font-bold tabular-nums ${sizeClass} ${colorClass}`}>
      <span className="leading-none">{arrow}</span>
      {showValue && !isNeutral && (
        <span>{Math.abs(delta).toFixed(1)}</span>
      )}
    </span>
  );
}
