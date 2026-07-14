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

test("real-data.json → RawData mapea campo por campo contra el JSON", () => {
  // OJO: nada de literales copiados del JSON — real-data.json cambia todas las
  // semanas (el bot commitea datos nuevos) y anclar valores exactos rompería el
  // CI en cada actualización legítima. Lo que se verifica es el MAPEO: cada
  // campo de RawData debe ser función de los campos correspondientes del JSON.
  const r = DEPUTIES[SAMPLE_ID];
  assert.ok(r, "el diputado de muestra existe en real-data.json");
  // El fixture debe seguir teniendo datos en todas las fuentes que probamos;
  // si alguna fuente desapareciera del JSON, fallar acá con mensaje claro.
  assert.ok((r.sesTotal ?? 0) > 0, "fixture sin sesiones de Delfino");
  assert.ok((r.votTotal ?? 0) > 0, "fixture sin votaciones de Delfino");
  assert.ok(r.asisCom + r.ausCom + r.permCom > 0, "fixture sin comisiones");
  assert.ok(typeof r.proyectos === "number", "fixture sin proyectos");
  assert.ok(r.med !== null, "fixture sin clasificación de medios");
  assert.equal(HAS_TRIPS, false, "esta legislatura aún no publica viajes");

  const p = getMockPoliticianById(SAMPLE_ID);
  assert.ok(p, "getMockPoliticianById devuelve el diputado");
  const raw = p!.rawData;

  const totalPL = r.asisPL + r.ausPL + r.permPL;
  const totalCom = r.asisCom + r.ausCom + r.permCom;

  // ASI: Delfino (sesAsis/sesTotal) tiene prioridad sobre el xlsx del plenario.
  assert.equal(raw.sesionesAsistidas, r.sesAsis);
  assert.equal(raw.sesionesTotales, r.sesTotal);
  // Votaciones.
  assert.equal(raw.votacionesAsistidas, r.votAsis);
  assert.equal(raw.votacionesTotales, r.votTotal);
  // Comisiones.
  assert.equal(raw.comisionesAsistidas, r.asisCom);
  assert.equal(raw.comisionesTotales, totalCom);
  // Permisos: permisos = permPL + permCom; totales = totalPL + totalCom.
  assert.equal(raw.permisos, r.permPL + r.permCom);
  assert.equal(raw.permisosTotales, totalPL + totalCom);
  // Proyectos / aprobados.
  assert.equal(raw.proyectosPresentados, r.proyectos);
  assert.equal(raw.proyectosAprobados, r.aprobados ?? 0);
  // Medios.
  assert.equal(raw.medPos, r.med!.pos);
  assert.equal(raw.medNeg, r.med!.neg);
  assert.equal(raw.medNeu, r.med!.neu);
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
