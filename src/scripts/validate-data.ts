/**
 * DiputadoScore — Validador independiente de data/real-data.json (auditor)
 *
 * Segunda barrera de la defensa de dos niveles (KTD 2): el script de ingesta es
 * la AUTORIDAD (se niega a escribir datos regresivos); este validador es el
 * AUDITOR que corre en CI DESPUÉS de la ingesta y, de forma independiente,
 * verifica el archivo antes de permitir el commit. Si falla, la corrida de CI
 * queda en rojo y no se commitea nada.
 *
 * La independencia es deliberada: el piso de diputados es la constante
 * committeada `MIN_DIPUTADOS` (no un número derivado del regex del roster que
 * usa el script — compartirían el mismo defecto). Además el validador falla si
 * el conteo del roster parseado NO coincide con la constante `ROSTER_COUNT`, de
 * modo que un cambio de formato en mockData.ts que rompa el regex no pueda
 * cegar ambos niveles a la vez.
 *
 * Solo imports relativos/builtin (sin alias `@/`) para que `tsx` lo corra
 * de forma independiente. Exporta funciones puras para las pruebas.
 */

import fs from "fs";
import path from "path";
import { MIN_DIPUTADOS } from "./ingest-lib";

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Cantidad de curules committeada (independiente del regex de mockData.ts).
 *  Si el roster parseado no da exactamente este número, algo cambió el formato
 *  de mockData.ts y el regex del script ya no es confiable → fallar. */
export const ROSTER_COUNT = 57;

/** Campos numéricos obligatorios por diputado (deben ser number). */
export const REQUIRED_NUMERIC_FIELDS = [
  "asisPL",
  "ausPL",
  "permPL",
  "asisCom",
  "ausCom",
  "permCom",
  "viajes",
] as const;

// ─── Parseo del roster (independence guard) ──────────────────────────────────

/** Extrae los ids del roster directamente del código fuente de mockData.ts,
 *  con el MISMO regex que usa el script — pero aquí solo para contrastar el
 *  conteo contra `ROSTER_COUNT`. */
export function parseRosterIds(mockSrc: string): string[] {
  const matches = [...mockSrc.matchAll(/\["(dep-[^"]+)",\s*"([^"]+)"/g)];
  return matches.map((m) => m[1]);
}

// ─── Chequeos puros ──────────────────────────────────────────────────────────

/** Cuenta diputados CON DATOS: asisPL+ausPL acumulados > 0. */
export function countDataBearing(
  deputies: Record<string, { asisPL?: unknown; ausPL?: unknown }>,
): number {
  let n = 0;
  for (const d of Object.values(deputies)) {
    const asis = typeof d.asisPL === "number" ? d.asisPL : 0;
    const aus = typeof d.ausPL === "number" ? d.ausPL : 0;
    if (asis + aus > 0) n++;
  }
  return n;
}

/**
 * Valida el objeto de datos ya parseado contra el roster.
 * Devuelve la lista de errores en español (vacía = válido).
 */
export function checkData(data: unknown, rosterIds: string[]): string[] {
  const errors: string[] = [];

  if (typeof data !== "object" || data === null) {
    return ["El JSON no es un objeto."];
  }
  const obj = data as Record<string, unknown>;

  const deputies = obj.deputies;
  if (typeof deputies !== "object" || deputies === null) {
    return ['Falta el objeto "deputies" o no es un objeto.'];
  }
  const deps = deputies as Record<string, Record<string, unknown>>;
  const ids = Object.keys(deps);

  if (ids.length === 0) {
    errors.push('El objeto "deputies" está vacío.');
  }

  // Conteo de diputados CON DATOS de asistencia ≥ MIN_DIPUTADOS.
  const dataBearing = countDataBearing(
    deps as Record<string, { asisPL?: unknown; ausPL?: unknown }>,
  );
  if (dataBearing < MIN_DIPUTADOS) {
    errors.push(
      `Diputados con datos de asistencia (${dataBearing}) por debajo del mínimo (${MIN_DIPUTADOS}).`,
    );
  }

  // Todo id de deputies debe pertenecer al roster.
  const rosterSet = new Set(rosterIds);
  const unknownIds = ids.filter((id) => !rosterSet.has(id));
  if (unknownIds.length) {
    errors.push(`Ids que no están en el roster: ${unknownIds.join(", ")}.`);
  }

  // Campos numéricos obligatorios bien tipados.
  for (const id of ids) {
    const entry = deps[id];
    if (typeof entry !== "object" || entry === null) {
      errors.push(`La entrada del diputado "${id}" no es un objeto.`);
      continue;
    }
    for (const field of REQUIRED_NUMERIC_FIELDS) {
      const v = entry[field];
      if (typeof v !== "number" || Number.isNaN(v)) {
        errors.push(
          `Campo numérico inválido en "${id}": ${field} = ${JSON.stringify(v)}.`,
        );
      }
    }
  }

  return errors;
}

/** Chequeo de independencia: el roster parseado debe tener ROSTER_COUNT ids. */
export function checkRoster(rosterIds: string[]): string[] {
  if (rosterIds.length !== ROSTER_COUNT) {
    return [
      `El roster parseado de mockData.ts tiene ${rosterIds.length} ids, se esperaban ${ROSTER_COUNT} (¿cambió el formato y se rompió el regex?).`,
    ];
  }
  return [];
}

/**
 * Orquestador puro: recibe el texto crudo del JSON de datos y el fuente de
 * mockData.ts; hace TODO el trabajo (parseo del roster, parseo del JSON con
 * captura de error, chequeos) y devuelve el resultado. Testeable sin I/O.
 */
export function validate(
  dataJson: string,
  mockSrc: string,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  const rosterIds = parseRosterIds(mockSrc);
  errors.push(...checkRoster(rosterIds));

  let data: unknown;
  try {
    data = JSON.parse(dataJson);
  } catch (e) {
    errors.push(
      `El archivo de datos no es JSON válido: ${(e as Error).message}.`,
    );
    return { ok: false, errors };
  }

  errors.push(...checkData(data, rosterIds));
  return { ok: errors.length === 0, errors };
}

// ─── main() ──────────────────────────────────────────────────────────────────

/** Corre el validador contra los archivos del repo. Devuelve el código de
 *  salida (0 ok, 1 falla) sin llamar a process.exit — para poder testearlo. */
export function runMain(cwd: string = process.cwd()): number {
  const dataPath = path.join(cwd, "data/real-data.json");
  const mockPath = path.join(cwd, "src/lib/mockData.ts");

  let dataJson: string;
  let mockSrc: string;
  try {
    dataJson = fs.readFileSync(dataPath, "utf8");
    mockSrc = fs.readFileSync(mockPath, "utf8");
  } catch (e) {
    console.error(
      `❌ No se pudo leer un archivo requerido: ${(e as Error).message}`,
    );
    return 1;
  }

  const { ok, errors } = validate(dataJson, mockSrc);
  if (ok) {
    console.log(
      "✅ Validación de datos correcta: data/real-data.json es válido.",
    );
    return 0;
  }
  console.error("❌ Validación de datos FALLIDA:");
  for (const err of errors) console.error(`   • ${err}`);
  return 1;
}

// Ejecutar solo cuando se corre directamente (no al importarse en pruebas).
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runMain());
}
