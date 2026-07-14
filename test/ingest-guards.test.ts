/**
 * Pruebas de las guardas de la ingesta (U2) contra los helpers puros, y del
 * validador (auditor) contra copias temporales. No hay I/O de red.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import {
  seedTotals,
  backfillAttendance,
  checkRegression,
  parseAttendance,
  MonthUnavailableError,
  shouldRollover,
  isDataBearing,
  MIN_DIPUTADOS,
  type Deputy,
  type DeputyTotals,
} from "../src/scripts/ingest-lib";
import { validate } from "../src/scripts/validate-data";

const ROOT = path.join(import.meta.dirname, "..");

const makeRoster = (n: number): Deputy[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `dep-${i}`,
    nombre: `Nombre ${i}`,
    tokens: [],
  }));

const existingFrom = (
  ids: string[],
  fields: Partial<DeputyTotals>,
): { deputies: Record<string, Partial<DeputyTotals>> } => ({
  deputies: Object.fromEntries(ids.map((id) => [id, { ...fields }])),
});

// ─── Freno de regresión ──────────────────────────────────────────────────────

test("fuente de asistencia vacía + existing presente → checkRegression rechaza", () => {
  const roster = makeRoster(55);
  const totals = seedTotals(roster); // toda la asistencia en cero
  const existing = existingFrom(
    roster.map((d) => d.id),
    { asisPL: 10, ausPL: 2 },
  );
  const res = checkRegression(totals, existing);
  assert.equal(res.ok, false);
  assert.equal(res.dataBearing, 0);
  assert.match(res.reason ?? "", /mínimo/);
});

test("primera corrida (existing null) con datos suficientes → procede", () => {
  const roster = makeRoster(55);
  const totals = seedTotals(roster);
  for (const entry of totals.values()) entry.asisPL = 10;
  const res = checkRegression(totals, null);
  assert.equal(res.ok, true);
  assert.ok(res.dataBearing >= MIN_DIPUTADOS);
});

test("asistencia acumulada que baja con lista de meses intacta → rechaza", () => {
  const roster = makeRoster(55);
  const totals = seedTotals(roster);
  for (const entry of totals.values()) entry.asisPL = 10;
  const existing = existingFrom(
    roster.map((d) => d.id),
    { asisPL: 10 },
  );
  // Un diputado con asistencia menor a la previa (sigue con datos > 0).
  totals.get("dep-0")!.asisPL = 5;
  const res = checkRegression(totals, existing);
  assert.equal(res.ok, false);
  assert.deepEqual(res.decreased, ["dep-0"]);
  assert.match(res.reason ?? "", /disminuyó/);
});

// ─── Backfill ────────────────────────────────────────────────────────────────

test("diputado con cero fetch pero existing no-cero → backfillAttendance restaura", () => {
  const roster = makeRoster(3);
  const totals = seedTotals(roster);
  const existing = {
    deputies: {
      "dep-0": {
        asisPL: 15,
        ausPL: 3,
        permPL: 1,
        asisCom: 5,
        ausCom: 0,
        permCom: 0,
        nombreXlsx: "Apellido Nombre",
      },
    },
  };
  assert.equal(isDataBearing(totals.get("dep-0")!), false);
  const restored = backfillAttendance(totals, existing);
  assert.deepEqual(restored, ["dep-0"]);
  const e = totals.get("dep-0")!;
  assert.equal(e.asisPL, 15);
  assert.equal(e.ausPL, 3);
  assert.equal(e.asisCom, 5);
  assert.equal(e.nombreXlsx, "Apellido Nombre");
  assert.equal(isDataBearing(e), true);
});

// ─── parseAttendance ─────────────────────────────────────────────────────────

const buildXlsx = (rows: (string | number)[][]): Buffer => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
};

test("parseAttendance con encabezados correctos → parsea la asistencia", () => {
  const buf = buildXlsx([
    [
      "Nombre",
      "Asis PL",
      "Aus PL",
      "Perm PL",
      "Asis Comisión",
      "Aus Comisión",
      "Perm Comisión",
    ],
    ["Acosta Jaén Nogui", 18, 2, 0, 12, 1, 0],
  ]);
  const map = parseAttendance(buf);
  const row = map.get("Acosta Jaén Nogui");
  assert.ok(row);
  assert.equal(row!.asisPL, 18);
  assert.equal(row!.ausPL, 2);
  assert.equal(row!.asisCom, 12);
});

test("parseAttendance con columnas renombradas/ausentes → MonthUnavailableError", () => {
  const buf = buildXlsx([
    ["Legislador", "Presente", "Ausente"],
    ["Acosta Jaén Nogui", 18, 2],
  ]);
  assert.throws(() => parseAttendance(buf), MonthUnavailableError);
});

test("parseAttendance sin filas de datos → MonthUnavailableError", () => {
  const buf = buildXlsx([["Nombre", "Asis PL", "Aus PL", "Perm PL"]]);
  assert.throws(() => parseAttendance(buf), MonthUnavailableError);
});

// ─── Rollover de legislatura (KTD 8) ─────────────────────────────────────────

test("shouldRollover: término válido + año que avanza + fuentes sanas → true", () => {
  assert.equal(shouldRollover("2030-2034", "2026-2030", true), true);
});

test("shouldRollover: drift de formato o corrida degradada → false", () => {
  assert.equal(
    shouldRollover("Legislatura 2030-2034", "2026-2030", true),
    false,
  );
  assert.equal(shouldRollover("2030-2034", "2026-2030", false), false);
  assert.equal(shouldRollover("2026-2030", "2026-2030", true), false); // no avanza
  assert.equal(shouldRollover("2022-2026", "2026-2030", true), false); // retrocede
});

// ─── Validador (auditor) ─────────────────────────────────────────────────────

const MOCK_SRC = fs.readFileSync(
  path.join(ROOT, "src/lib/mockData.ts"),
  "utf8",
);
const GOOD_DATA = fs.readFileSync(
  path.join(ROOT, "data/real-data.json"),
  "utf8",
);

test("validate: verde sobre el data/real-data.json committeado", () => {
  const res = validate(GOOD_DATA, MOCK_SRC);
  assert.equal(res.ok, true, res.errors.join("; "));
});

test("validate: rojo con deputies vacío", () => {
  const res = validate(JSON.stringify({ deputies: {} }), MOCK_SRC);
  assert.equal(res.ok, false);
});

test("validate: rojo con un id fuera del roster", () => {
  const parsed = JSON.parse(GOOD_DATA);
  parsed.deputies["dep-inventado-xyz"] = {
    asisPL: 1,
    ausPL: 1,
    permPL: 0,
    asisCom: 0,
    ausCom: 0,
    permCom: 0,
    viajes: 0,
  };
  const res = validate(JSON.stringify(parsed), MOCK_SRC);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /roster/.test(e)));
});

test("validate: rojo con JSON truncado", () => {
  const res = validate(GOOD_DATA.slice(0, 120), MOCK_SRC);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /JSON válido/.test(e)));
});
