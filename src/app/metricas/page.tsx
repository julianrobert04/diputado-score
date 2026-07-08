import type { Metadata } from "next";
import Link from "next/link";
import { METRIC_META, DIMENSION_META, ScoreMetrics } from "@/types";
import { REAL_DATA_INFO } from "@/lib/mockData";

export const metadata: Metadata = {
  title: "Métricas · DiputadoScore",
  description:
    "Cómo calificamos a los diputados: 8 métricas con datos 100% reales, inspiradas en los ratings del fútbol.",
};

const CODES = Object.keys(METRIC_META) as (keyof ScoreMetrics)[];
const MAYORES = CODES.filter((c) => METRIC_META[c].weight >= 0.2);
const MENORES = CODES.filter((c) => METRIC_META[c].weight > 0 && METRIC_META[c].weight < 0.2);
const DORMIDAS = CODES.filter((c) => METRIC_META[c].weight === 0);

const DIM_OF: Record<string, { label: string; color: string }> = {};
for (const dim of Object.values(DIMENSION_META)) {
  for (const m of dim.metrics) DIM_OF[m] = { label: dim.label, color: dim.color };
}

function MetricRow({ code }: { code: keyof ScoreMetrics }) {
  const meta = METRIC_META[code];
  const dim = DIM_OF[code];
  return (
    <div className="flex items-start gap-4 bg-zinc-900 rounded-2xl ring-1 ring-white/[0.06] p-5 hover:ring-white/[0.12] transition-all">
      <span className="flex-shrink-0 w-12 h-12 rounded-xl bg-zinc-800/80 ring-1 ring-white/[0.05] flex items-center justify-center text-[0.7rem] font-black text-emerald-400 tracking-wide">
        {code}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-1">
          <h3 className="text-white font-bold text-[0.95rem]">{meta.label}</h3>
          <span className="text-[0.65rem] font-bold text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded-md tabular-nums">
            {(meta.weight * 100).toFixed(0)}%
          </span>
          {dim && (
            <span
              className="text-[0.62rem] font-semibold px-2 py-0.5 rounded-md"
              style={{ color: dim.color, backgroundColor: `${dim.color}1a` }}
            >
              {dim.label}
            </span>
          )}
          <span className={`text-[0.62rem] font-semibold px-2 py-0.5 rounded-md ${meta.higherIsBetter ? "text-emerald-400 bg-emerald-500/10" : "text-orange-400 bg-orange-500/10"}`}>
            {meta.higherIsBetter ? "más = mejor" : "menos = mejor"}
          </span>
        </div>
        <p className="text-zinc-500 text-sm leading-relaxed">{meta.description}</p>
        <p className="text-zinc-700 text-[0.68rem] mt-1.5">Fuente: {meta.source}</p>
      </div>
    </div>
  );
}

export default function MetricasPage() {
  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0c0c0e]/80 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
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
            <Link href="/rankings" className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors">
              Rankings
            </Link>
            <Link href="/metricas" className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-white/[0.07] transition-colors">
              Métricas
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-tight mb-3">
            Las <span className="text-emerald-400">métricas</span>
          </h1>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-xl">
            Inspirado en las métricas con las que calificamos el rendimiento de los
            jugadores de fútbol en cada partido. Cada diputado recibe un score del 1 al 10
            calculado solo con datos públicos reales — sin estimaciones: si no hay dato
            público, la métrica queda neutra en 5.0.
          </p>
        </div>

        {/* Mayores */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <h2 className="text-[0.7rem] font-semibold text-zinc-500 uppercase tracking-widest">
              Métricas mayores
            </h2>
            <span className="text-[0.65rem] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              20% cada una
            </span>
          </div>
          <div className="space-y-2.5">
            {MAYORES.map((code) => <MetricRow key={code} code={code} />)}
          </div>
        </div>

        {/* Menores */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <h2 className="text-[0.7rem] font-semibold text-zinc-500 uppercase tracking-widest">
              Métricas menores
            </h2>
            <span className="text-[0.65rem] font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md">
              10% cada una
            </span>
          </div>
          <div className="space-y-2.5">
            {MENORES.map((code) => <MetricRow key={code} code={code} />)}
          </div>
        </div>

        {/* Dormidas */}
        {DORMIDAS.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2.5 mb-4">
              <h2 className="text-[0.7rem] font-semibold text-zinc-500 uppercase tracking-widest">
                En espera de datos
              </h2>
              <span className="text-[0.65rem] font-bold text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-md">
                se activan solas
              </span>
            </div>
            <div className="space-y-2.5 opacity-60">
              {DORMIDAS.map((code) => <MetricRow key={code} code={code} />)}
            </div>
          </div>
        )}

        {/* Cómo se calcula */}
        <div className="bg-zinc-900 rounded-2xl ring-1 ring-white/[0.06] p-6">
          <h2 className="text-base font-bold text-white mb-4">Cómo se calcula el score</h2>
          <ul className="space-y-3 text-sm text-zinc-500 leading-relaxed">
            <li className="flex gap-2.5">
              <span className="text-emerald-400 flex-shrink-0">•</span>
              El score general es la suma ponderada de las métricas: las mayores pesan 20% y las menores 10%.
            </li>
            <li className="flex gap-2.5">
              <span className="text-emerald-400 flex-shrink-0">•</span>
              Las métricas relativas comparan contra el promedio del período: estar en el promedio da 5.0,
              destacar acerca al 10 y quedarse atrás acerca al 0.
            </li>
            <li className="flex gap-2.5">
              <span className="text-emerald-400 flex-shrink-0">•</span>
              Sin dato público la métrica queda neutra en 5.0 — nunca se castiga ni se premia sin evidencia.
            </li>
            <li className="flex gap-2.5">
              <span className="text-emerald-400 flex-shrink-0">•</span>
              Los datos se actualizan automáticamente cada semana desde el portal de datos abiertos de la
              Asamblea Legislativa, la API de Delfino.cr y Google News.
            </li>
          </ul>
          <p className="text-zinc-700 text-xs mt-5">
            Última actualización: {new Date(REAL_DATA_INFO.updatedAt).toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </main>

      <footer className="mt-20 border-t border-white/[0.04] py-8">
        <div className="max-w-3xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-zinc-700 text-xs">
          <p>Datos: Asamblea Legislativa Open Data · Delfino.cr · Google News</p>
          <p>DiputadoScore no es afiliado a ningún partido político.</p>
        </div>
      </footer>
    </div>
  );
}
