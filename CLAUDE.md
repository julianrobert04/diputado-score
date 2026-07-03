@AGENTS.md

# DiputadoScore — Guía completa del proyecto

## ¿Qué es esto?

Plataforma de transparencia política para Costa Rica estilo SofaScore/365Scores.
Muestra a los 57 diputados de la Asamblea Legislativa 2026–2030 con scores del 1 al 10
basados en asistencia, proyectos de ley, gasto y declaración de bienes.

**URL en producción:** pendiente de desplegar  
**Stack:** Next.js 16 · Tailwind v4 · Prisma 7 · PostgreSQL (opcional)

---

## Setup rápido

```bash
npm install
npm run dev          # → http://localhost:3000
```

Sin base de datos funciona igual — todo cae en mock data automáticamente.

Si tenés PostgreSQL:
```bash
cp .env.example .env   # crear si no existe, añadir DATABASE_URL
npx prisma db push
npm run ingest:real    # descarga datos reales de la Asamblea
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
│   ├── mockData.ts               ← 57 diputados reales con fotos + datos simulados
│   ├── scoreCalculator.ts        ← Fórmulas de scoring (11 métricas → 5 dimensiones)
│   └── prisma.ts                 ← Cliente Prisma con adapter-pg
├── scripts/
│   └── ingest-real.ts            ← Ingesta de datos reales (Asamblea + CGR)
└── types/index.ts                ← Tipos TypeScript + LegislativeBill
```

**Patrón de datos:** Cada página hace `try { DB } catch { mockData }`.
Si no hay `DATABASE_URL`, el sitio funciona 100% con mock data.

---

## El sistema de scores

### 11 métricas → 5 dimensiones → 1 score overall

| Dimensión | Peso | Métricas |
|-----------|------|----------|
| Presencia | 15% | ASI (asistencia plenario), COM (asistencia comisiones) |
| Productividad | 25% | PRO (proyectos), APR (aprobados), MOC (mociones) |
| Transparencia | 20% | DEC (declaración de bienes CGR) |
| Gasto | 15% | GAS (gasto representación), VIA (viajes), ASE (asesores) |
| Participación | 25% | VOT (participación en votaciones), COH (coherencia) |

Scores van de 1.0 a 10.0. Color por score:
- **gold** ≥ 8.5 · **green** ≥ 7.0 · **yellow** ≥ 5.5 · **orange** ≥ 4.0 · **red** < 4.0

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
| `asamblea.go.cr` SharePoint | Fotos de 52/57 diputados | ✅ Funcionando |
| `cgrfiles.cgr.go.cr` | CSV aggregate de DJB (no por diputado) | ⚠ Aggregate only |
| `cgr.go.cr/morosos` | Lista HTML de incumplidores DJB | ⚠ Necesita adaptar parser |

### ❌ Lo que NO funciona (y por qué)

| Fuente | Problema |
|--------|----------|
| `delfino.cr/asamblea/...` | App React CSR — no hay datos en el HTML, API privada |
| `asamblea.go.cr/opendata/...` | URLs 404 — el portal de datos no existe aún para 2026 |
| `sil.go.cr` | No responde desde fuera de Costa Rica |

### 🔮 Cómo conseguir datos reales cuando estén disponibles

La Asamblea publica CSVs de asistencia en períodos. Buscar:
```
https://www.asamblea.go.cr/pa/datosabiertos/
```

El script `npm run ingest:real` está listo — solo necesita que las URLs de descarga existan.
Cuando corras el script, guarda `data/real-scores.json` localmente y si hay `DATABASE_URL`,
hace upsert en Prisma automáticamente.

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
npm run ingest:real      # Descargar datos reales (requiere internet + opcionalmente DB)
npm run db:studio        # Abrir Prisma Studio (requiere DATABASE_URL)
npm run db:push          # Aplicar schema a la DB sin migraciones
```
