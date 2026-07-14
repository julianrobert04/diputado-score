import { ScoreMetrics, DIMENSION_META } from "@/types";
import { getScoreColor } from "@/lib/scoreCalculator";

interface Props {
  metrics: ScoreMetrics;
  size?: number;
}

const SCORE_FILL: Record<string, string> = {
  gold: "rgba(251,191,36,0.15)",
  green: "rgba(52,211,153,0.15)",
  yellow: "rgba(250,204,21,0.15)",
  orange: "rgba(249,115,22,0.15)",
  red: "rgba(244,63,94,0.15)",
  gray: "rgba(113,113,122,0.10)",
};

const SCORE_STROKE: Record<string, string> = {
  gold: "#fbbf24",
  green: "#34d399",
  yellow: "#facc15",
  orange: "#f97316",
  red: "#f43f5e",
  gray: "#71717a",
};

const DIMS = Object.entries(DIMENSION_META) as [
  keyof typeof DIMENSION_META,
  (typeof DIMENSION_META)[keyof typeof DIMENSION_META],
][];
const N = DIMS.length; // 5

function pentagon(cx: number, cy: number, r: number, rotation = -Math.PI / 2) {
  return Array.from({ length: N }, (_, i) => {
    const angle = rotation + (2 * Math.PI * i) / N;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

function toPolygon(pts: { x: number; y: number }[]) {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

export function RadarChart({ metrics, size = 260 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.32;
  const labelR = maxR + 18;

  const dimScores = DIMS.map(([, dim]) => {
    const vals = dim.metrics.map((m) => metrics[m as keyof ScoreMetrics] ?? 0);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  const overall = dimScores.reduce((a, b) => a + b, 0) / dimScores.length;
  const color = getScoreColor(overall);

  const gridLevels = [2, 4, 6, 8, 10];

  const dataPoints = DIMS.map(([, dim], i) => {
    const r = (dimScores[i] / 10) * maxR;
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / N;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  const labelPoints = pentagon(cx, cy, labelR);

  // Etiqueta accesible: enumera cada dimensión con su puntaje para lectores de
  // pantalla, ya que el gráfico es puramente visual.
  const ariaLabel = `Radar de desempeño por dimensión: ${DIMS.map(
    ([, dim], i) => `${dim.label} ${dimScores[i].toFixed(1)} de 10`,
  ).join(", ")}.`;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Grid levels */}
      {gridLevels.map((level) => {
        const pts = pentagon(cx, cy, (level / 10) * maxR);
        return (
          <polygon
            key={level}
            points={toPolygon(pts)}
            fill="none"
            stroke="#27272a"
            strokeWidth="1"
          />
        );
      })}

      {/* Grid axes */}
      {pentagon(cx, cy, maxR).map((pt, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={pt.x}
          y2={pt.y}
          stroke="#27272a"
          strokeWidth="1"
        />
      ))}

      {/* Data polygon */}
      <polygon
        points={toPolygon(dataPoints)}
        fill={SCORE_FILL[color]}
        stroke={SCORE_STROKE[color]}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Data dots */}
      {dataPoints.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="3" fill={SCORE_STROKE[color]} />
      ))}

      {/* Labels — centrados y con clamp para que no se corten en los bordes */}
      {DIMS.map(([, dim], i) => {
        const lp = labelPoints[i];
        // Ancho aproximado del label para mantenerlo dentro del viewBox
        const halfWidth = dim.label.length * 2;
        const x = Math.min(Math.max(lp.x, halfWidth + 4), size - halfWidth - 4);
        const score = dimScores[i];
        const dimColor = getScoreColor(score);
        const strokeColor = SCORE_STROKE[dimColor];

        return (
          <g key={i}>
            <text
              x={x}
              y={lp.y - 3}
              textAnchor="middle"
              fontSize="8"
              fontWeight="700"
              fill={strokeColor}
              fontFamily="system-ui, sans-serif"
            >
              {score.toFixed(1)}
            </text>
            <text
              x={x}
              y={lp.y + 8}
              textAnchor="middle"
              fontSize="7"
              fill="#71717a"
              fontFamily="system-ui, sans-serif"
            >
              {dim.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
