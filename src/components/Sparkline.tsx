"use client";

import { ScoreSnapshot } from "@/types";

interface SparklineProps {
  snapshots: ScoreSnapshot[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Sparkline SVG — gráfico de línea minimalista al estilo SofaScore
 * para mostrar la evolución del score a lo largo del tiempo.
 */
export function Sparkline({
  snapshots,
  width = 80,
  height = 28,
  className = "",
}: SparklineProps) {
  if (snapshots.length < 2) {
    return (
      <span className="text-xs text-zinc-400 italic">
        {snapshots.length === 0 ? "Sin historial" : "1 dato"}
      </span>
    );
  }

  const values = snapshots.map((s) => s.overall);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // evitar división por cero

  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  // Mapear valores a coordenadas SVG (Y invertido)
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = points.join(" ");

  // Color según tendencia general (primer vs último)
  const trend = values[values.length - 1] - values[0];
  const strokeColor =
    trend > 0.1 ? "#10b981" : trend < -0.1 ? "#ef4444" : "#6b7280";

  // Punto final
  const lastPoint = points[points.length - 1].split(",");
  const lastX = parseFloat(lastPoint[0]);
  const lastY = parseFloat(lastPoint[1]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Tendencia del score: de ${values[0].toFixed(1)} a ${values[values.length - 1].toFixed(1)}`}
    >
      {/* Línea de tendencia */}
      <polyline
        points={polyline}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      {/* Punto actual */}
      <circle cx={lastX} cy={lastY} r="2.5" fill={strokeColor} />
    </svg>
  );
}

/**
 * SparklineCard — versión expandida con eje de fechas y valores mín/máx,
 * para la página de perfil del diputado.
 */
export function SparklineCard({
  snapshots,
  title = "Evolución del score",
}: {
  snapshots: ScoreSnapshot[];
  title?: string;
}) {
  if (snapshots.length < 2) {
    return (
      <div className="h-full flex flex-col">
        <h2 className="text-sm font-semibold text-zinc-400 mb-4">{title}</h2>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
          <svg
            className="w-8 h-8 text-zinc-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941"
            />
          </svg>
          <p className="text-zinc-400 text-xs max-w-[220px] leading-relaxed">
            La tendencia aparece cuando la actualización semanal acumule más de
            un corte de datos.
          </p>
        </div>
      </div>
    );
  }

  const values = snapshots.map((s) => s.overall);
  const dates = snapshots.map((s) => new Date(s.takenAt));
  const min = Math.min(...values);
  const max = Math.max(...values);

  const w = 600;
  const h = 120;
  const padX = 8;
  const padY = 10;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const range = max - min || 0.1;

  const points = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * innerW;
    const y = padY + innerH - ((v - min) / range) * innerH;
    return { x, y, v, date: dates[i], delta: snapshots[i].deltaOverall };
  });

  const polyline = points
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  // Área bajo la curva
  const areaPoints =
    `${points[0].x.toFixed(1)},${h} ` +
    polyline +
    ` ${points[points.length - 1].x.toFixed(1)},${h}`;

  const trend = values[values.length - 1] - values[0];
  const strokeColor =
    trend > 0.1 ? "#10b981" : trend < -0.1 ? "#ef4444" : "#6b7280";
  const fillColor =
    trend > 0.1 ? "#10b98120" : trend < -0.1 ? "#ef444420" : "#6b728020";

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("es-CR", { day: "numeric", month: "short" });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-400">{title}</h2>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>
            Mín <span className="text-white font-bold">{min.toFixed(1)}</span>
          </span>
          <span>
            Máx <span className="text-white font-bold">{max.toFixed(1)}</span>
          </span>
          <span>
            Cambio{" "}
            <span
              className={`font-bold ${trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-gray-400"}`}
            >
              {trend > 0 ? "+" : ""}
              {trend.toFixed(1)}
            </span>
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        style={{ height: "120px" }}
        role="img"
        aria-label={`Evolución del score: ${values.map((v) => v.toFixed(1)).join(", ")}`}
      >
        {/* Líneas guía horizontales */}
        {[0.25, 0.5, 0.75].map((pct) => {
          const y = padY + innerH - pct * innerH;
          const val = min + pct * range;
          return (
            <g key={pct}>
              <line
                x1={padX}
                y1={y}
                x2={w - padX}
                y2={y}
                stroke="#374151"
                strokeWidth="0.5"
                strokeDasharray="4 4"
              />
              <text
                x={padX - 4}
                y={y + 3}
                fontSize="8"
                fill="#a1a1aa"
                textAnchor="end"
              >
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Área */}
        <polygon points={areaPoints} fill={fillColor} />

        {/* Línea */}
        <polyline
          points={polyline}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Puntos con tooltip data */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill={strokeColor} />
            {/* Puntos de delta marcado con flecha (sólo si hay delta significativo) */}
            {p.delta !== null && Math.abs(p.delta ?? 0) >= 0.1 && (
              <text
                x={p.x}
                y={p.y - 6}
                fontSize="7"
                fill={(p.delta ?? 0) > 0 ? "#10b981" : "#ef4444"}
                textAnchor="middle"
                fontWeight="bold"
              >
                {(p.delta ?? 0) > 0 ? "▲" : "▼"}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Eje de fechas */}
      <div className="flex justify-between mt-1 text-xs text-zinc-400">
        <span>{fmtDate(dates[0])}</span>
        {dates.length > 4 && (
          <span>{fmtDate(dates[Math.floor(dates.length / 2)])}</span>
        )}
        <span>{fmtDate(dates[dates.length - 1])}</span>
      </div>

      {/* Lista de cambios recientes */}
      {snapshots.filter(
        (s) => s.deltaOverall !== null && Math.abs(s.deltaOverall) >= 0.1,
      ).length > 0 && (
        <div className="mt-4 border-t border-gray-800 pt-4">
          <p className="text-xs text-zinc-400 mb-2">Cambios registrados</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {[...snapshots]
              .reverse()
              .filter(
                (s) =>
                  s.deltaOverall !== null && Math.abs(s.deltaOverall) >= 0.1,
              )
              .slice(0, 8)
              .map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-zinc-400">
                    {new Date(s.takenAt).toLocaleDateString("es-CR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 font-mono">
                      {s.overall.toFixed(1)}
                    </span>
                    <span
                      className={`font-bold ${(s.deltaOverall ?? 0) > 0 ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {(s.deltaOverall ?? 0) > 0 ? "+" : ""}
                      {(s.deltaOverall ?? 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
