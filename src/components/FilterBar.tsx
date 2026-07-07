"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const PROVINCIAS = [
  "San José", "Alajuela", "Cartago", "Heredia",
  "Guanacaste", "Puntarenas", "Limón",
];

const PARTIDOS = [
  "Partido Pueblo Soberano",
  "Partido Liberación Nacional",
  "Frente Amplio",
  "Coalición Agenda Ciudadana",
  "Partido Unidad Social Cristiana",
];

const SORT_OPTIONS = [
  { value: "overall_desc", label: "Mejor score" },
  { value: "overall_asc", label: "Peor score" },
  { value: "name_asc", label: "Nombre A–Z" },
  { value: "name_desc", label: "Nombre Z–A" },
];

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-3">
      {/* Provincia */}
      <select
        value={searchParams.get("provincia") ?? ""}
        onChange={(e) => updateParam("provincia", e.target.value)}
        className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-white/[0.07] text-zinc-300 text-sm focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
      >
        <option value="">Todas las provincias</option>
        {PROVINCIAS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {/* Partido */}
      <select
        value={searchParams.get("partido") ?? ""}
        onChange={(e) => updateParam("partido", e.target.value)}
        className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-white/[0.07] text-zinc-300 text-sm focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
      >
        <option value="">Todos los partidos</option>
        {PARTIDOS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {/* Ordenar */}
      <select
        value={searchParams.get("sort") ?? "overall_desc"}
        onChange={(e) => updateParam("sort", e.target.value)}
        className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-white/[0.07] text-zinc-300 text-sm focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
