/**
 * Pruebas del matcher de nombres (U4): detección de ambigüedad, alias de typos
 * oficiales, mejor match claro, y grounding del margen contra el roster real.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchDeputyResult,
  normalize,
  AMBIGUITY_MARGIN,
  type Deputy,
} from "../src/scripts/ingest-lib";
import { getMockPoliticians } from "../src/lib/mockData";

/** Roster real reconstruido desde el export público de mockData. */
const ROSTER: Deputy[] = getMockPoliticians("", "", "name_asc").map((c) => ({
  id: c.card.id,
  nombre: c.card.fullName,
  tokens: normalize(c.card.fullName),
}));

const dep = (id: string, nombre: string): Deputy => ({
  id,
  nombre,
  tokens: normalize(nombre),
});

test("dos nombres dentro del margen de ambigüedad → null + razón 'ambiguo'", () => {
  const pares: Deputy[] = [
    dep("a", "José Mora Vega"),
    dep("b", "José Mora Vargas"),
  ];
  const r = matchDeputyResult("Mora José", pares);
  assert.equal(r.id, null);
  assert.equal(r.id === null && r.reason, "ambiguo");
  // Confirma que efectivamente están dentro del margen configurado.
  const a = matchDeputyResult("Mora José", [pares[0]]);
  const b = matchDeputyResult("Mora José", [pares[1]]);
  assert.ok(
    Math.abs(a.score - b.score) < AMBIGUITY_MARGIN,
    "los dos candidatos están dentro del margen",
  );
});

test("alias de typo oficial (Sáenz Blanco Joselyn) matchea vía NAME_ALIASES", () => {
  const r = matchDeputyResult("Sáenz Blanco Joselyn", ROSTER);
  assert.equal(r.id, "dep-joselyn-saenz");
});

test("typo tolerado por editDistance1 (Chavaría → Chavarría) matchea", () => {
  const small = ROSTER.filter((d) =>
    ["dep-marco-badilla", "dep-diana-murillo", "dep-nogui-acosta"].includes(
      d.id,
    ),
  );
  const r = matchDeputyResult("Badilla Chavaría Marco", small);
  assert.equal(r.id, "dep-marco-badilla");
});

test("mejor match claro ≥0.6 con segundo lejano → matcheado", () => {
  const r = matchDeputyResult("Acosta Jaén Nogui", ROSTER);
  assert.equal(r.id, "dep-nogui-acosta");
  assert.ok(r.id !== null && r.score >= 0.6);
});

test("grounding del margen: cada nombre real del roster matchea el suyo sin ambigüedad", () => {
  for (const d of ROSTER) {
    const r = matchDeputyResult(d.nombre, ROSTER);
    assert.equal(
      r.id,
      d.id,
      `${d.nombre} debería matchear ${d.id} inequívocamente, dio ${JSON.stringify(r)}`,
    );
  }
});
