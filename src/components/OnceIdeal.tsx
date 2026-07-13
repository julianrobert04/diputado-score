import Link from "next/link";
import { RankingAvatar } from "./RankingAvatar";
import { getScoreColor } from "@/lib/scoreCalculator";

export interface OnceIdealPlayer {
  id: string;
  fullName: string;
  photoUrl: string;
  overall: number;
}

const CHIP_BG: Record<string, string> = {
  gold:   "bg-amber-500",
  green:  "bg-emerald-500",
  yellow: "bg-yellow-500",
  orange: "bg-orange-500",
  red:    "bg-rose-500",
  gray:   "bg-zinc-600",
};

// Formación 4-3-3 · posiciones en % (x, y) sobre media cancha vertical
const FORMATION: { x: number; y: number }[] = [
  { x: 24, y: 12 }, { x: 50, y: 9 }, { x: 76, y: 12 },              // delanteros: ranks 1-3
  { x: 25, y: 37 }, { x: 50, y: 34 }, { x: 75, y: 37 },             // mediocampo: 4-6
  { x: 13, y: 63 }, { x: 38, y: 60 }, { x: 62, y: 60 }, { x: 87, y: 63 }, // defensa: 7-10
  { x: 50, y: 84 },                                                  // portero: 11
];

// Nombres ticos: primer nombre + primer apellido
function shortName(fullName: string): string {
  const parts = fullName.split(" ");
  if (parts.length <= 2) return fullName;
  return `${parts[0]} ${parts[parts.length - 2]}`;
}

/** Alineación estilo SofaScore con los 11 diputados mejor calificados */
export function OnceIdeal({ players }: { players: OnceIdealPlayer[] }) {
  if (players.length < 11) return null;
  const xi = players.slice(0, 11);

  return (
    <div className="relative w-full max-w-lg mx-auto aspect-[4/5] rounded-2xl overflow-hidden ring-1 ring-emerald-500/[0.15]">
      {/* Césped: franjas verticales sutiles */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgba(16,185,129,0.055) 0, rgba(16,185,129,0.055) 12.5%, rgba(16,185,129,0.028) 12.5%, rgba(16,185,129,0.028) 25%)",
        }}
      />
      {/* Líneas de cancha */}
      <div className="absolute inset-x-0 top-0 h-px bg-white/[0.08]" />
      {/* Círculo central (media cancha, arriba) */}
      <div className="absolute left-1/2 top-0 w-[34%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.08]" />
      {/* Área grande */}
      <div className="absolute left-1/2 bottom-0 w-[58%] h-[16%] -translate-x-1/2 border border-b-0 border-white/[0.08]" />
      {/* Área chica */}
      <div className="absolute left-1/2 bottom-0 w-[28%] h-[6.5%] -translate-x-1/2 border border-b-0 border-white/[0.08]" />
      {/* Semicírculo del área */}
      <div className="absolute left-1/2 bottom-[16%] w-[18%] aspect-[2/1] -translate-x-1/2 translate-y-px rounded-t-full border border-b-0 border-white/[0.08]" />

      {/* Jugadores */}
      {xi.map((p, i) => {
        const pos = FORMATION[i];
        const color = getScoreColor(p.overall);
        return (
          <Link
            key={p.id}
            href={`/diputados/${p.id}`}
            className="absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${pos.x}%`, top: `${pos.y + 8}%` }}
          >
            <div className="relative">
              <RankingAvatar
                photoUrl={p.photoUrl}
                fullName={p.fullName}
                size={44}
                ringClass="ring-2 ring-black/40"
              />
              <span
                className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 ${CHIP_BG[color]} rounded-[0.3rem] px-1 py-[0.15rem] text-[0.58rem] font-black tabular-nums leading-none text-white shadow ring-1 ring-black/30`}
              >
                {p.overall.toFixed(1)}
              </span>
            </div>
            <span className="mt-1 text-[0.6rem] font-semibold text-zinc-300 bg-black/50 backdrop-blur px-1.5 py-0.5 rounded-md leading-none max-w-[5.5rem] truncate group-hover:text-emerald-400 transition-colors">
              {shortName(p.fullName)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
