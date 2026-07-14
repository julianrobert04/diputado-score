@AGENTS.md

# DiputadoScore — Guía completa del proyecto

## ¿Qué es esto?

Plataforma de transparencia política para Costa Rica estilo SofaScore/365Scores.
Muestra a los 57 diputados de la Asamblea Legislativa 2026–2030 con scores del 1 al 10
basados en asistencia, permisos, proyectos de ley y cobertura mediática —
**todas las métricas usan datos reales**, sin simulación.

**URL en producción:** pendiente de desplegar  
**Stack:** Next.js 16 · Tailwind v4

---

## Setup rápido

```bash
npm install
npm run dev          # → http://localhost:3000
```

No necesita base de datos — los datos reales vienen versionados en `data/real-data.json`.
Para regenerarlos:

```bash
npm run ingest:opendata                        # asistencia + viajes + proyectos de ley
ANTHROPIC_API_KEY=sk-... npm run ingest:opendata  # + clasificación de noticias (MED)
```

> **Node:** Si `npm` falla, usar el binario descargado:
> `/tmp/node-v20.19.2-darwin-arm64/bin/npx tsx ...`

---

## Arquitectura

```
src/
├── app/
│   ├── page.tsx                  ← Homepage (grid de cards)
│   ├── rankings/page.tsx         ← Tabla de rankings con filtros
│   └── diputados/[id]/page.tsx   ← Perfil individual
├── components/
│   ├── PoliticianCard.tsx        ← Card estilo 365Scores (foto + score badge top-left)
│   ├── TrendBadge.tsx            ← Flecha ▲▼ de tendencia
│   ├── Sparkline.tsx             ← Mini gráfico de historial
│   └── FilterBar.tsx / SearchBar.tsx
├── lib/
│   ├── mockData.ts               ← 57 diputados reales con fotos + datos de data/real-data.json
│   └── scoreCalculator.ts        ← Fórmulas de scoring (7 métricas → 3 dimensiones)
├── scripts/
│   ├── ingest-opendata.ts        ← Ingesta semanal (Asamblea Open Data + Google News + Claude)
│   ├── ingest-lib.ts             ← Funciones puras de la ingesta (matching, parseo, frenos) — testeable
│   ├── validate-data.ts          ← Validador del JSON antes del commit (compuerta del workflow)
│   └── certs/                    ← Cadena GlobalSign para verificar TLS de asamblea.go.cr
│                                    (se regenera con `npm run cert:update`)
└── types/index.ts                ← Tipos TypeScript + LegislativeBill
```

**Patrón de datos:** Las páginas leen directamente de `src/lib/mockData.ts`, que a su vez
importa `data/real-data.json` (versionado en git, regenerado semanalmente por GitHub Actions).
No hay base de datos: el sitio es completamente estático y se alimenta del JSON versionado.

---

## El sistema de scores

### 7 métricas reales → suma ponderada → 1 score overall

| Métrica | Peso    | Qué mide                                                                            |
| ------- | ------- | ----------------------------------------------------------------------------------- |
| ASI     | **30%** | Asistencia: promedio de sesiones del plenario y votaciones, **al día** (Delfino.cr) |
| PRO     | **30%** | Proyectos de ley presentados, primera firma (Delfino.cr)                            |
| COM     | 10%     | Asistencia a comisiones (Asamblea Open Data, xlsx mensual)                          |
| PER     | 10%     | Permisos vs promedio, menos = mejor (Asamblea Open Data)                            |
| APR     | 10%     | Tasa de aprobación de sus proyectos, con umbral (Delfino.cr)                        |
| MED     | 10%     | Cobertura mediática (Google News + Claude)                                          |

ASI promedia dos ratios de Delfino (`representativesMeetingAssistance` y
`representativesVoteAssistance`, desde el inicio de la legislatura hasta hoy) —
por eso sube y baja con cada corrida semanal. Si Delfino no responde, cae al
xlsx mensual de la Asamblea. `METRIC_WEIGHTS` en `scoreCalculator.ts` es la
fuente de verdad. `DIMENSION_META` agrupa las métricas solo para la UI
(Presencia 50 / Productividad 40 / Imagen 10).

\* VIA (viajes) entra con 15% y el resto se escala ×0.85 cuando la Asamblea publique
xlsx de viajes de la legislatura 2026-2030 — se activa solo (`includeVIA` en `calcOverall`).

**MED:** noticia positiva suma, negativa resta, sin noticias = 5.5 neutro.
Fórmula: `clamp(5.5 + 4.5·(pos−neg)/max(total,5), 1, 10)` sobre los totales
**acumulados desde el inicio de la legislatura** — cada corrida semanal clasifica
solo los titulares nuevos (dedupe por `medSeen`, hash sha1 del titular normalizado)
y los suma a pos/neg/neu. Clasificación con Claude Haiku (requiere secret
`ANTHROPIC_API_KEY` en GitHub). Sin API key la ingesta preserva el acumulado.

**PRO:** proyectos de ley con primera firma del diputado (API GraphQL de Delfino.cr,
`https://api.delfino.cr/graphql`). `directRelativeScore`: promedio → 5.0, cero → 0,
doble del promedio → 10, **con suavizado de confianza**: `5 + (raw−5)·min(1, avg/2)`.
Al inicio de la legislatura (avg bajo) la escala se comprime hacia el 5 neutro y se
endurece sola conforme sube el promedio de proyectos.

**APR:** tasa de aprobación con umbral — sin proyectos o sin aprobados aún → 5.0
neutro (las leyes toman años); con aprobados: `5 + (aprobados/propuestos)·5` hasta 10,
con el mismo suavizado de confianza que PRO.
"Aprobado" = estado final (Aprobado, Resellado), NO cuenta "Aprobado en Primer Debate".

**PER/VIA** usan `inverseRelativeScore` vs el promedio del período:
en el promedio → 5.0, en cero → 10, al doble del promedio → 0.

Scores van de 1.0 a 10.0. Color por score:

- **green** ≥ 7.0 · **yellow** ≥ 5.5 · **orange** ≥ 4.0 · **red** < 4.0 · **gray** = 0

Ver `src/lib/scoreCalculator.ts` para las fórmulas exactas.

---

## Fotos de diputados

Las fotos son públicas en el SharePoint de la Asamblea:

```
https://www.asamblea.go.cr/Diputados/SiteAssets/2026-2030/{partido}_{ap1}_{ap2}.jpg
```

**Prefijos confirmados:** `ps` (PPSO), `ln` (PLN), `fa` (FA), `cac` (CAC), `usc` (PUSC)

**IMPORTANTE:** La Asamblea tiene typos en algunos nombres de archivo:

- `cac_dobles_damargo.jpg` (no "camargo")
- `fa_trejos_mazarieros.jpg` (no "mazariegos")
- `ln_hidalgo_sols.jpg` (no "solís")

El mapa exacto está en `PHOTO_OVERRIDES` dentro de `src/lib/mockData.ts`.

5 diputados sin foto aún subida → muestran inicial como fallback:

- José María Villalta Flórez-Estrada
- Joselyn Sáenz Núñez
- Yara Jiménez Fallas
- Nayuribe Guadamuz Rosales
- Royner Mora Ruiz

La Asamblea tiene SSL inválido → `next.config.ts` usa `remotePatterns` con `unoptimized`.
El script de ingesta usa `https.Agent({ rejectUnauthorized: false })`.

---

## Datos reales — fuentes y estado

### ✅ Lo que funciona hoy

| Fuente                                         | Qué trae                                                                                 | Estado                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `asamblea.go.cr/pa/datosabiertos`              | **Asistencia real mensual (xlsx)** — PL + comisiones, 57 diputados desde 2026-05         | ✅ **Integrado** (`npm run ingest:opendata`)               |
| `asamblea.go.cr/pa/datosabiertos` GastosViajes | Viajes institucionales (xlsx mensual)                                                    | ✅ Parser listo — aún sin archivos de la legislatura nueva |
| `api.delfino.cr/graphql`                       | **Proyectos de ley por diputado (PRO/APR)** — primera firma, por legislatura, con status | ✅ **Integrado** (mismo `ingest:opendata`)                 |
| `asamblea.go.cr` SharePoint                    | Fotos de 52/57 diputados                                                                 | ✅ Funcionando                                             |
| `cgrfiles.cgr.go.cr`                           | CSV aggregate de DJB (no por diputado)                                                   | ⚠ Aggregate only                                           |
| `cgr.go.cr/morosos`                            | Lista HTML de incumplidores DJB                                                          | ⚠ Necesita adaptar parser                                  |

Los datos reales viven en `data/real-data.json` (versionado). `mockData.ts` los mezcla
sobre las métricas simuladas vía `mergeRealData()` y expone `getRealMetrics(id)` +
`REAL_DATA_INFO` para que la UI marque qué es real vs estimado.

**Actualización automática:** `.github/workflows/update-data.yml` corre cada lunes,
re-ingesta y commitea si hay datos nuevos → Vercel redespliega solo.

**Ojo:** los xlsx oficiales usan formato "Apellidos Nombre" y tienen typos
(ej. "Chavaría"); el matcher usa Jaccard con tolerancia de 1 edición por token.
Los nombres de mockData se corrigieron contra el xlsx oficial (Esmeralda Britton,
Gerald Bogantes, Roberth Barrantes, Kattya Mora, Kattia Calvo, Joselyn Sáenz Blanco).

### ❌ Lo que NO funciona (y por qué)

| Fuente                             | Problema                                                         |
| ---------------------------------- | ---------------------------------------------------------------- |
| `sil.go.cr` / `sil.asamblea.go.cr` | No responde / página IIS por defecto                             |
| `datosabiertos.asamblea.go.cr`     | Responde 403/404                                                 |
| DJB por diputado (DEC)             | Las declaraciones son confidenciales; CGR solo publica aggregate |

**Todas las 7 métricas son reales: ASI, COM, PER, PRO, APR, MED** (+ VIA que se
activa solo cuando la Asamblea suba xlsx de viajes de la legislatura 2026-2030).
COS y ASE (costo del despacho / asesores) se eliminaron por decisión de producto —
generaban debate sobre si más o menos asesores es "mejor". Las métricas viejas
MOC, VOT, COH, DEC y GAS se eliminaron por falta de fuente pública machine-readable.

### PRO/APR — proyectos de ley (Delfino.cr)

- API GraphQL pública: `https://api.delfino.cr/graphql` (POST JSON)
- `{ currentTerm { id name } }` → legislatura actual (id 4 = "2026-2030")
- `{ representatives(term: "2026-2030", active: true) { id name } }` — ojo: `term` es String
- `query($r: Int, $t: Int) { projects(representativeId: $r, termId: $t, limit: 500) { status } }` — solo primera firma
- Aprobado = status contiene "aprobado" o "resellado", pero NO "primer debate"
- **ASI**: `representativesMeetingAssistance(from, to)` y `representativesVoteAssistance(from, to)` `{ representative { name } sessionsAttended totalEligibleSessions }` — asistencia a sesiones y a votaciones del plenario, al día

### MED — cobertura mediática

- Fuente: Google News RSS por diputado (`"{nombre}" when:30d`, es-419/CR)
- Clasificación: Claude Haiku (`claude-haiku-4-5-20251001`) en `ingest:opendata`
- Requiere `ANTHROPIC_API_KEY`; sin key preserva la clasificación previa
- `DUMP_HEADLINES=1` vuelca los titulares a `/tmp/headlines.json` para revisión manual
- Ojo con homónimos (cantantes, futbolistas extranjeros) — el prompt le pide a Claude
  marcar como X lo que no sea del diputado costarricense

---

## Diseño — principios

- **Fondo:** `#0c0c0e` / `bg-[#0c0c0e]`
- **Cards:** `bg-zinc-900` con `ring-1 ring-white/[0.06]`
- **Score badge:** esquina top-left de la foto circular, pill sólido del color del score
- **Inspiración:** SofaScore player cards + 365Scores ratings
- **Grid:** `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`

---

## Próximos pasos sugeridos

### Prioritarios

1. **Búsqueda funcional** — el `SearchBar` existe pero falta filtrar el array en `page.tsx`
2. **Despliegue** — Vercel (sitio estático, sin base de datos). El redeploy debe dispararse
   con el commit semanal de datos para que las actualizaciones lleguen a los usuarios.
3. **Datos reales de asistencia** — cuando la Asamblea publique CSVs 2026

### Deseables

4. **Partido como filtro** — además de provincia ya hay soporte, falta UI
5. **Comparar diputados** — selector múltiple + radar chart
6. **SEO** — `generateMetadata` por diputado para compartir en redes
7. **PWA / notificaciones** — alertar cuando cambia el score de tu diputado

---

## Variables de entorno

```env
ANTHROPIC_API_KEY=sk-ant-...   # solo la ingesta la usa para clasificar titulares (métrica MED)
```

No hay base de datos ni `DATABASE_URL`. Sin `ANTHROPIC_API_KEY` la ingesta corre igual y
**preserva** los conteos MED previos (nunca los reinicia); el sitio funciona sin la clave.

---

## Comandos útiles

```bash
npm run dev              # Servidor de desarrollo
npm run build            # Build de producción
npm run ingest:opendata  # Re-generar data/real-data.json (ANTHROPIC_API_KEY opcional para MED)
```
