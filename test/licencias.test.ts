/**
 * Pruebas del registro de licencias: un diputado en licencia no recibe score
 * ni entra en rankings/promedios, y la licencia respeta su ventana de fechas.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getLicencia,
  getMockPoliticians,
  getScoredPoliticians,
  getMockPoliticianById,
} from "../src/lib/mockData";
import licenciasData from "../data/licencias.json";

const LICENCIAS = licenciasData.licencias;

test("cada licencia declara fuente, fechas válidas y diputado existente", () => {
  assert.ok(LICENCIAS.length > 0, "el registro tiene al menos una licencia");
  for (const l of LICENCIAS) {
    assert.ok(
      getMockPoliticianById(l.deputyId),
      `${l.deputyId} debe existir en el padrón`,
    );
    assert.match(l.fuente, /^https:\/\//, "la fuente debe ser un URL público");
    assert.ok(l.etiqueta.length > 0, "la licencia debe tener etiqueta visible");
    const desde = new Date(l.desde).getTime();
    assert.ok(Number.isFinite(desde), `fecha 'desde' inválida en ${l.deputyId}`);
    if (l.hasta !== null) {
      const hasta = new Date(l.hasta).getTime();
      assert.ok(Number.isFinite(hasta), `fecha 'hasta' inválida en ${l.deputyId}`);
      assert.ok(hasta > desde, "la licencia debe terminar después de empezar");
    }
  }
});

test("getLicencia respeta la ventana de fechas", () => {
  const l = LICENCIAS[0];
  const desde = new Date(l.desde);
  const antes = new Date(desde.getTime() - 24 * 3600 * 1000);
  const durante = new Date(desde.getTime() + 24 * 3600 * 1000);

  assert.equal(
    getLicencia(l.deputyId, antes),
    null,
    "un día antes del inicio no hay licencia vigente",
  );
  assert.ok(
    getLicencia(l.deputyId, durante),
    "un día después del inicio la licencia está vigente",
  );
  if (l.hasta !== null) {
    const despues = new Date(new Date(l.hasta).getTime() + 24 * 3600 * 1000);
    assert.equal(
      getLicencia(l.deputyId, despues),
      null,
      "pasada la fecha de fin la licencia ya no aplica",
    );
  }
});

test("los diputados en licencia quedan fuera del listado con score", () => {
  const todos = getMockPoliticians();
  const conScore = getScoredPoliticians();
  const enLicencia = todos.filter((p) => p.licencia);

  assert.equal(
    conScore.length + enLicencia.length,
    todos.length,
    "todo diputado o tiene score o está en licencia",
  );
  assert.ok(enLicencia.length > 0, "hay al menos un diputado en licencia hoy");
  for (const p of conScore) {
    assert.equal(p.licencia, null, "ningún rankeado está en licencia");
  }
});

test("los diputados en licencia van al final del listado general", () => {
  const todos = getMockPoliticians();
  const primerLicencia = todos.findIndex((p) => p.licencia);
  if (primerLicencia === -1) return;
  for (let i = primerLicencia; i < todos.length; i++) {
    assert.ok(
      todos[i].licencia,
      "después del primero en licencia no vuelve a haber diputados con score",
    );
  }
});
