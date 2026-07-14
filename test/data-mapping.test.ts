/**
 * Pruebas del mapeo data/real-data.json → RawData vía los exports reales de
 * mockData. Se toma una rebanada representativa del archivo committeado y se
 * verifica campo por campo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { getMockPoliticianById, getRealMetrics } from "../src/lib/mockData";
import realData from "../data/real-data.json";

const DEPUTIES = realData.deputies as Record<
  string,
  {
    asisPL: number;
    ausPL: number;
    permPL: number;
    asisCom: number;
    ausCom: number;
    permCom: number;
    viajes: number;
    proyectos?: number | null;
    aprobados?: number | null;
    sesAsis?: number | null;
    sesTotal?: number | null;
    votAsis?: number | null;
    votTotal?: number | null;
    med: { pos: number; neg: number; neu: number; total: number } | null;
    nombreXlsx: string;
  }
>;
const HAS_TRIPS = (realData.tripMonths as string[]).length > 0;

const SAMPLE_ID = "dep-nogui-acosta";

test("real-data.json → RawData mapea campo por campo (valores exactos conocidos)", () => {
  // Fixture con valores no-nulos conocidos: se afirman los números EXACTOS de
  // forma incondicional (nada de `if (typeof …)` que colapsa a "existe").
  // Primero se ancla el fixture: si el JSON committeado cambiara estos valores,
  // el test debe fallar aquí (no silenciarse).
  const r = DEPUTIES[SAMPLE_ID];
  assert.ok(r, "el diputado de muestra existe en real-data.json");
  assert.equal(r.asisPL, 18);
  assert.equal(r.ausPL, 0);
  assert.equal(r.permPL, 0);
  assert.equal(r.asisCom, 12);
  assert.equal(r.ausCom, 0);
  assert.equal(r.permCom, 0);
  assert.equal(r.sesAsis, 37);
  assert.equal(r.sesTotal, 37);
  assert.equal(r.votAsis, 244);
  assert.equal(r.votTotal, 248);
  assert.equal(r.proyectos, 0);
  assert.equal(r.aprobados, 0);
  assert.deepEqual(r.med, { pos: 5, neg: 11, neu: 10, total: 26 });
  assert.equal(HAS_TRIPS, false, "esta legislatura aún no publica viajes");

  const p = getMockPoliticianById(SAMPLE_ID);
  assert.ok(p, "getMockPoliticianById devuelve el diputado");
  const raw = p!.rawData;

  // ASI: Delfino (sesAsis/sesTotal) tiene prioridad sobre el xlsx del plenario.
  assert.equal(raw.sesionesAsistidas, 37);
  assert.equal(raw.sesionesTotales, 37);
  // Votaciones.
  assert.equal(raw.votacionesAsistidas, 244);
  assert.equal(raw.votacionesTotales, 248);
  // Comisiones: totalCom = 12 + 0 + 0.
  assert.equal(raw.comisionesAsistidas, 12);
  assert.equal(raw.comisionesTotales, 12);
  // Permisos: permisos = permPL + permCom = 0; totales = totalPL(18) + totalCom(12).
  assert.equal(raw.permisos, 0);
  assert.equal(raw.permisosTotales, 30);
  // Proyectos / aprobados.
  assert.equal(raw.proyectosPresentados, 0);
  assert.equal(raw.proyectosAprobados, 0);
  // Medios.
  assert.equal(raw.medPos, 5);
  assert.equal(raw.medNeg, 11);
  assert.equal(raw.medNeu, 10);
  // Viajes: sin tripMonths publicados, VIA no se mapea.
  assert.equal(
    raw.viajesOficiales,
    undefined,
    "sin tripMonths no se mapea VIA",
  );
});

test("id de diputado inexistente → ruta null", () => {
  assert.equal(getMockPoliticianById("dep-no-existe-xyz"), null);
  assert.deepEqual(getRealMetrics("dep-no-existe-xyz"), []);
});

test("el set de realMetrics coincide con los campos con datos", () => {
  const r = DEPUTIES[SAMPLE_ID];
  const metrics = new Set(getRealMetrics(SAMPLE_ID));

  const totalPL = r.asisPL + r.ausPL + r.permPL;
  const totalCom = r.asisCom + r.ausCom + r.permCom;
  const hasASI =
    (typeof r.sesTotal === "number" && r.sesTotal > 0) ||
    totalPL > 0 ||
    (typeof r.votTotal === "number" && r.votTotal > 0);

  assert.equal(metrics.has("ASI"), hasASI);
  assert.equal(metrics.has("COM"), totalCom > 0);
  assert.equal(metrics.has("PER"), totalPL + totalCom > 0);
  assert.equal(metrics.has("PRO"), typeof r.proyectos === "number");
  assert.equal(metrics.has("APR"), typeof r.proyectos === "number");
  assert.equal(metrics.has("MED"), r.med !== null);
  assert.equal(metrics.has("VIA"), HAS_TRIPS);
});
