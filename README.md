# DiputadoScore 🏛️

Transparencia política costarricense al estilo SofaScore. Muestra a los 57
diputados de la Asamblea Legislativa 2026–2030 con un score del 1 al 10,
calculado **solo con datos reales** (asistencia, permisos, proyectos de ley y
cobertura mediática), sin simulación.

Es un **sitio estático de Next.js 16** alimentado por una ingesta semanal que
corre en GitHub Actions y versiona el resultado en `data/real-data.json`.
**No hay base de datos:** las páginas leen ese JSON en tiempo de build.

## Setup

```bash
npm install
npm run dev          # → http://localhost:3000
```

No hace falta configurar nada más: los datos reales ya vienen versionados en
`data/real-data.json`.

## El modelo de score

7 métricas reales se combinan en una suma ponderada (`METRIC_WEIGHTS` en
`src/lib/scoreCalculator.ts` es la fuente de verdad):

| Métrica | Peso    | Qué mide                                                           | Fuente                                     |
| ------- | ------- | ------------------------------------------------------------------ | ------------------------------------------ |
| ASI     | **30%** | Asistencia: promedio de sesiones del plenario y votaciones, al día | Delfino.cr (respaldo: xlsx de la Asamblea) |
| PRO     | **30%** | Proyectos de ley presentados (primera firma)                       | Delfino.cr                                 |
| COM     | 10%     | Asistencia a comisiones                                            | Asamblea Open Data (xlsx mensual)          |
| PER     | 10%     | Permisos vs promedio (menos = mejor)                               | Asamblea Open Data                         |
| APR     | 10%     | Tasa de aprobación de sus proyectos, con umbral                    | Delfino.cr                                 |
| MED     | 10%     | Cobertura mediática (positivas − negativas)                        | Google News + Claude                       |

**VIA (viajes oficiales)** se activa solo cuando la Asamblea publique los xlsx de
viajes de esta legislatura: entra con 15% y el resto de las métricas se escala
×0.85 (`includeVIA` en `calcOverall`). Hoy no hay archivos, así que VIA está
inactivo.

**MED** acumula desde el inicio de la legislatura: cada corrida clasifica solo
los titulares nuevos (dedupe por hash sha1) y los suma. La clasificación usa
Claude (requiere el secret `ANTHROPIC_API_KEY`). **Una corrida sin la API key
preserva el acumulado previo de MED — nunca lo resetea.**

## Scripts

```bash
npm run dev              # servidor de desarrollo
npm run build            # build de producción
npm run lint             # ESLint
npm run ingest:opendata  # regenera data/real-data.json
```

> `test` y `typecheck` se agregan en este mismo PR (suite con `node:test` + `tsx`
> y `tsc --noEmit`), junto con el gate de CI que corre lint/typecheck/test/build.

Para regenerar los datos, incluyendo la clasificación mediática:

```bash
ANTHROPIC_API_KEY=sk-... npm run ingest:opendata
```

## Flujo de actualización de datos

`.github/workflows/update-data.yml` corre **cada lunes**:

1. **Ingesta** (`ingest:opendata`) con **freno de regresión**: el script se
   siembra con el roster completo de 57 diputados, mezcla las métricas nuevas de
   forma aditiva y **se niega a escribir** (sale con código 1) si el resultado
   regresa — menos diputados con datos que el mínimo esperado, o asistencia
   acumulada que baja respecto al archivo previo. La escritura es atómica
   (archivo temporal en `data/` + rename).
2. **Validación** independiente del archivo generado (conteo mínimo de diputados,
   ids contra el roster, tipos de los campos). Si falla, el job queda en rojo y
   **no commitea**.
3. **Commit** solo si la validación pasa y el diff es real (se enmascara
   `updatedAt` antes de comparar, porque cambia en cada corrida).
4. **Redeploy** del sitio en el hosting a partir del commit.

## TLS: `src/scripts/certs/globalsign-chain.pem`

El servidor de la Asamblea (`www.asamblea.go.cr`) sirve solo su certificado hoja
y **omite el intermedio** en el handshake TLS. Node no hace AIA chasing, así que
la verificación falla con `unable to verify the first certificate`.

En vez de bajar la seguridad con `rejectUnauthorized: false`, la ingesta usa un
`https.Agent` con la cadena de GlobalSign versionada en
`src/scripts/certs/globalsign-chain.pem` (intermedio _GlobalSign GCC R3 DV TLS CA
2020_ + raíz _GlobalSign Root CA - R3_), aplicada solo al host de la Asamblea. La
verificación TLS queda **totalmente activa**.

**Vencimiento de la hoja del servidor: 2026-07-28.** El escenario de renovación
ya está cubierto:

1. Si renuevan con el mismo emisor de GlobalSign, la cadena fijada sigue
   validando — no hay que hacer nada.
2. Si cambian de CA y el servidor nuevo envía la cadena completa, la ingesta
   cae automáticamente al almacén de confianza por defecto de Node (fallback
   pinned → default, ambos con verificación activa).
3. Si cambian de CA y vuelven a omitir el intermedio, la ingesta lo avisa en el
   log y el arreglo es un comando:

   ```bash
   npm run cert:update   # regenera src/scripts/certs/globalsign-chain.pem
   ```

   El script lee la cadena del servidor, baja el intermedio vía AIA si falta,
   toma la raíz del almacén local de Node (nunca de la red), verifica la cadena
   candidata con un handshake real y recién entonces sobreescribe el PEM.
   Después: commitear el PEM regenerado.

Mientras tanto los datos existentes se preservan — un fallo TLS se trata como
"mes no disponible", nunca como datos en cero.

## Riesgo residual del parser `xlsx`

`xlsx@0.18.5` (fijado exacto) tiene CVEs sin parche en npm (contaminación de
prototipos, ReDoS); las versiones corregidas solo se publican en el registro
propio de SheetJS. La mitigación en este PR es por **capas**, y hay que ser
honesto sobre lo que hace cada una:

- **TLS verificado** cierra la vía de entrega por MITM.
- **Verificación de bytes mágicos** (`50 4B 03 04`) + rechazo de content-types
  HTML antes de `XLSX.read`: **detiene páginas de error HTML** que de otro modo se
  parsearían como datos basura. **NO detiene un workbook malicioso**, que es en sí
  un ZIP válido.

Tras el arreglo de TLS, el **riesgo residual** es una fuente comprometida (la
propia Asamblea) sirviendo un workbook hostil a un job de CI que tiene
`ANTHROPIC_API_KEY` y un token de escritura. El **reemplazo del parser** por uno
mantenido queda como **trabajo futuro**.

## Arquitectura

```
src/
├── app/                          ← páginas (home, rankings, métricas, perfil)
├── components/                   ← cards, sparkline, radar, avatares
├── lib/
│   ├── mockData.ts               ← 57 diputados + merge de data/real-data.json
│   └── scoreCalculator.ts        ← fórmulas de scoring (METRIC_WEIGHTS)
├── scripts/
│   ├── ingest-opendata.ts        ← ingesta semanal (entry point)
│   ├── ingest-lib.ts             ← funciones puras de matching/parsing (testeable)
│   ├── validate-data.ts          ← valida el JSON antes del commit (compuerta del workflow)
│   └── certs/globalsign-chain.pem ← cadena TLS de la Asamblea
└── types/index.ts                ← tipos + metadata de métricas
```

Las páginas leen `data/real-data.json` (versionado en git) a través de
`mockData.ts`. La UI marca qué métricas son reales vs estimadas.
