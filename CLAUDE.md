@AGENTS.md

# DiputadoScore — Guía completa del proyecto

## ¿Qué es esto?

Plataforma de transparencia política para Costa Rica estilo SofaScore/365Scores.
Muestra a los 57 diputados de la Asamblea Legislativa 2026–2030 con scores del 1 al 10
basados en asistencia, permisos, costo del despacho, asesores y cobertura mediática —
**todas las métricas usan datos reales**, sin simulación.

**URL en producción:** pendiente de desplegar  
**Stack:** Next.js 16 · Tailwind v4 · Prisma 7 · PostgreSQL (opcional)

---

## Setup rápido

```bash
npm install
npm run dev          # → http://localhost:3000
```

No necesita base de datos — los datos reales vienen versionados en `data/real-data.json`.
Para regenerarlos:
```bash
npm run ingest:opendata                        # asistencia + salarios + viajes
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
│   ├── scoreCalculator.ts        ← Fórmulas de scoring (7 métricas → 3 dimensiones)
│   └── prisma.ts                 ← Cliente Prisma con adapter-pg (no usado por las páginas)
├── scripts/
│   └── ingest-opendata.ts        ← Ingesta semanal (Asamblea Open Data + Google News + Claude)
└── types/index.ts                ← Tipos TypeScript + LegislativeBill
```

**Patrón de datos:** Las páginas leen directamente de `src/lib/mockData.ts`, que a su vez
importa `data/real-data.json` (versionado en git, regenerado semanalmente por GitHub Actions).
No se necesita base de datos; Prisma quedó opcional/inactivo.

---

## El sistema de scores

### 7 métricas reales → 3 dimensiones → 1 score overall

| Dimensión | Peso | Métricas |
|-----------|------|----------|
| Presencia | 45% | ASI (asistencia plenario), COM (comisiones), PER (permisos) |
| Austeridad | 30% | COS (costo del despacho), ASE (asesores), VIA (viajes)* |
| Imagen pública | 25% | MED (cobertura mediática: Google News + Claude) |

\* VIA se excluye de Austeridad (queda `(COS+ASE)/2`) hasta que la Asamblea publique
xlsx de viajes de la legislatura 2026-2030 — se activa solo (`includeVIA` en `calcOverall`).

**MED:** noticia positiva suma, negativa resta, sin noticias = 5.5 neutro.
Fórmula: `clamp(5.5 + 4.5·(pos−neg)/max(total,5), 1, 10)`. Clasificación con
Claude Haiku en la ingesta semanal (requiere secret `ANTHROPIC_API_KEY` en GitHub).
Sin API key la ingesta preserva la clasificación anterior de `real-data.json`.

**COS/ASE/PER/VIA** usan `inverseRelativeScore` vs el promedio del período:
en el promedio → 5.0, en cero → 10, al doble del promedio → 0.

Scores van de 1.0 a 10.0. Color por score:
- **gold** ≥ 9.0 · **green** ≥ 7.0 · **yellow** ≥ 5.5 · **orange** ≥ 4.0 · **red** < 4.0

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

| Fuente | Qué trae | Estado |
|--------|----------|--------|
| `asamblea.go.cr/pa/datosabiertos` | **Asistencia real mensual (xlsx)** — PL + comisiones, 57 diputados desde 2026-05 | ✅ **Integrado** (`npm run ingest:opendata`) |
| `asamblea.go.cr/pa/datosabiertos` GastosViajes | Viajes institucionales (xlsx mensual) | ✅ Parser listo — aún sin archivos de la legislatura nueva |
| `asamblea.go.cr/pa/datosabiertos` SalarioFuncionarios | **Asesores reales por diputado (ASE)** — filas "DIP. NOMBRE (PARTIDO)" en DEPENDENCIA FUNCIONAL | ✅ **Integrado** (mismo `ingest:opendata`) |
| `asamblea.go.cr` SharePoint | Fotos de 52/57 diputados | ✅ Funcionando |
| `cgrfiles.cgr.go.cr` | CSV aggregate de DJB (no por diputado) | ⚠ Aggregate only |
| `cgr.go.cr/morosos` | Lista HTML de incumplidores DJB | ⚠ Necesita adaptar parser |

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

| Fuente | Problema |
|--------|----------|
| `delfino.cr/asamblea/...` | App React CSR — no hay datos en el HTML, API privada |
| `sil.go.cr` / `sil.asamblea.go.cr` | No responde desde fuera de Costa Rica |
| Proyectos de ley por diputado (PRO/APR) | Páginas SharePoint de Consultas_SIL dan 404; `datosabiertos.asamblea.go.cr` responde 403/404; el portal de datos abiertos no tiene carpeta de proyectos ni votaciones |
| DJB por diputado (DEC) | Las declaraciones son confidenciales; CGR solo publica aggregate |

**Todas las 7 métricas son reales: ASI, COM, PER, COS, ASE, MED** (+ VIA que se
activa solo cuando la Asamblea suba xlsx de viajes de la legislatura 2026-2030).
Las métricas viejas PRO, APR, MOC, VOT, COH, DEC y GAS se eliminaron del sistema
por falta de fuente pública machine-readable.

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
2. **Despliegue** — Vercel + Neon (PostgreSQL serverless gratis), variables:
   - `DATABASE_URL` → Neon connection string
3. **Datos reales de asistencia** — cuando la Asamblea publique CSVs 2026

### Deseables
4. **Partido como filtro** — además de provincia ya hay soporte, falta UI
5. **Comparar diputados** — selector múltiple + radar chart
6. **SEO** — `generateMetadata` por diputado para compartir en redes
7. **PWA / notificaciones** — alertar cuando cambia el score de tu diputado

---

## Variables de entorno

```env
DATABASE_URL=postgresql://user:pass@host:5432/diputadoscore
```

Sin `DATABASE_URL` el sitio funciona igual con mock data.

---

## Comandos útiles

```bash
npm run dev              # Servidor de desarrollo
npm run build            # Build de producción
npm run ingest:opendata  # Re-generar data/real-data.json (ANTHROPIC_API_KEY opcional para MED)
```
