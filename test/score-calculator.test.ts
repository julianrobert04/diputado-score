/**
 * Pruebas del calculador de score (scoreCalculator).
 * Se prueban las funciones REALES exportadas contra fixtures calculados a mano.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcMetrics,
  calcOverall,
  getScoreColor,
} from "../src/lib/scoreCalculator";
import type { ScoreMetrics } from "../src/types";

const ZERO_AVGS = { avgPermRatio: 0, avgViajes: 0, avgProyectos: 0 };

const uniform = (v: number): ScoreMetrics => ({
  ASI: v,
  COM: v,
  PER: v,
  PRO: v,
  APR: v,
  MED: v,
  VIA: v,
});

test("calcOverall fija el piso en 1.0 cuando todas las métricas son 0", () => {
  // suma ponderada = 0 → clamp(0,1,10) = 1 → 1.0 (piso)
  assert.equal(calcOverall(uniform(0)), 1.0);
});

test("calcOverall fija el techo en 10.0 cuando todas las métricas son 10", () => {
  assert.equal(calcOverall(uniform(10)), 10.0);
  assert.equal(calcOverall(uniform(10), { includeVIA: true }), 10.0);
});

test("una métrica individual se recorta al rango [1,10] (MED en los extremos)", () => {
  // pos=10,neg=0 → 5.5+4.5·1 = 10 (techo)
  assert.equal(
    calcMetrics({ medPos: 10, medNeg: 0, medNeu: 0 }, ZERO_AVGS).MED,
    10,
  );
  // pos=0,neg=10 → 5.5+4.5·(-1) = 1 (piso, recortado)
  assert.equal(
    calcMetrics({ medPos: 0, medNeg: 10, medNeu: 0 }, ZERO_AVGS).MED,
    1,
  );
});

test("caída a 5 neutro en cada ruta de dato faltante (MED cae a 5.5)", () => {
  const m = calcMetrics({}, ZERO_AVGS);
  assert.equal(m.ASI, 5, "ASI sin sesiones ni votaciones → 5");
  assert.equal(m.COM, 5, "COM sin comisiones → 5");
  assert.equal(m.PRO, 5, "PRO sin proyectos (no numérico) → 5");
  assert.equal(m.APR, 5, "APR sin proyectos/aprobados → 5");
  assert.equal(m.VIA, 5, "VIA sin viajes (no numérico) → 5");
  assert.equal(m.MED, 5.5, "MED sin noticias → 5.5 (neutro propio de MED)");
});

test("suavizado de confianza PRO: 5 + (raw−5)·min(1, avg/2) con proyectos=6", () => {
  const pro = (avgProyectos: number): number =>
    calcMetrics({ proyectosPresentados: 6 }, { ...ZERO_AVGS, avgProyectos })
      .PRO;
  // avg 0 → conf 0 → PRO = 5 (comprime todo al neutro)
  assert.equal(pro(0), 5);
  // avg 1 → conf 0.5, dRS(6,1)=10 → 5 + 5·0.5 = 7.5
  assert.equal(pro(1), 7.5);
  // avg 2 → conf 1, dRS(6,2)=10 → 5 + 5·1 = 10
  assert.equal(pro(2), 10);
  // avg 4 → conf = min(1, 4/2) = 1 (topado), dRS(6,4)=7.5 → 5 + 2.5·1 = 7.5
  assert.equal(pro(4), 7.5);
});

test("suavizado de confianza APR usa la misma confianza que PRO", () => {
  const apr = (avgProyectos: number): number =>
    calcMetrics(
      { proyectosPresentados: 4, proyectosAprobados: 2 },
      { ...ZERO_AVGS, avgProyectos },
    ).APR;
  // aprBase = clamp(5 + (2/4)·5, 5, 10) = 7.5
  assert.equal(apr(0), 5, "conf 0 → APR neutro 5");
  assert.equal(apr(2), 7.5, "conf 1 → APR = aprBase = 7.5");
});

test("fórmula MED: clamp(5.5 + 4.5·(pos−neg)/max(total,5), 1, 10)", () => {
  const med = (pos: number, neg: number, neu: number): number =>
    calcMetrics({ medPos: pos, medNeg: neg, medNeu: neu }, ZERO_AVGS).MED;
  // pos3 neg1 total4 → max(4,5)=5 → 5.5 + 4.5·(2/5) = 7.3
  assert.equal(med(3, 1, 0), 7.3);
  // sin noticias → 5.5
  assert.equal(med(0, 0, 0), 5.5);
});

test("inverseRelativeScore (rama avg>0) vía VIA: clamp(10 − (value/avg)·5)", () => {
  const via = (viajesOficiales: number, avgViajes: number): number =>
    calcMetrics({ viajesOficiales }, { ...ZERO_AVGS, avgViajes }).VIA;
  // avg 2 (>0): en cero → 10, a la mitad → 7.5, en el promedio → 5, al doble → 0.
  assert.equal(via(0, 2), 10); // 10 − 0·5
  assert.equal(via(1, 2), 7.5); // 10 − 0.5·5
  assert.equal(via(2, 2), 5); // 10 − 1·5
  assert.equal(via(4, 2), 0); // 10 − 2·5 = 0 (recortado en el piso)
});

test("inverseRelativeScore (rama avg>0) vía PER: permRatio relativo al promedio", () => {
  const per = (
    permisos: number,
    permisosTotales: number,
    avgPermRatio: number,
  ): number =>
    calcMetrics({ permisos, permisosTotales }, { ...ZERO_AVGS, avgPermRatio })
      .PER;
  // permRatio 0.05 vs avg 0.1 → ratio 0.5 → 10 − 2.5 = 7.5
  assert.equal(per(1, 20, 0.1), 7.5);
  // permRatio 0.1 vs avg 0.1 → ratio 1 → 5
  assert.equal(per(1, 10, 0.1), 5);
  // permRatio 0.2 vs avg 0.1 → ratio 2 → 0 (recortado)
  assert.equal(per(2, 10, 0.1), 0);
});

test("calcOverall: los pesos suman 1.0 (métrica uniforme v → overall v)", () => {
  // Si los pesos no sumaran 1, el overall base no igualaría el valor uniforme.
  assert.equal(calcOverall(uniform(6)), 6.0);
  assert.equal(calcOverall(uniform(3)), 3.0);
});

test("consistencia VIA-off vs VIA-on: base·0.85 + VIA·0.15", () => {
  const m: ScoreMetrics = {
    ASI: 8,
    PRO: 6,
    COM: 5,
    PER: 4,
    APR: 7,
    MED: 5,
    VIA: 2,
  };
  const base = calcOverall(m); // VIA excluido = suma ponderada = 6.3
  assert.equal(base, 6.3);
  const withVia = calcOverall(m, { includeVIA: true });
  // 6.3·0.85 + 2·0.15 = 5.655 → 5.7
  const expected = Math.round((base * 0.85 + m.VIA * 0.15) * 10) / 10;
  assert.equal(withVia, expected);
  assert.equal(withVia, 5.7);
});

test("getScoreColor: umbrales verde/amarillo/naranja/rojo/gris", () => {
  assert.equal(getScoreColor(8), "green");
  assert.equal(getScoreColor(6), "yellow");
  assert.equal(getScoreColor(4.5), "orange");
  assert.equal(getScoreColor(2), "red");
  assert.equal(getScoreColor(0), "gray");
});
