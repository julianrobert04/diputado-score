# DiputadoScore 🏛️

Transparencia política costarricense al estilo SofaScore.

## Setup rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar base de datos
```bash
cp .env.local .env.local
# Editar DATABASE_URL con tu PostgreSQL
```

**Opciones para PostgreSQL:**
- **Railway** (recomendado para deploy): https://railway.app → New Project → PostgreSQL
- **Local**: `createdb diputadoscore`
- **Render**: https://render.com → New → PostgreSQL

### 3. Crear tablas
```bash
npm run db:push
```

### 4. Cargar datos iniciales
```bash
npm run ingest
```

### 5. Correr en desarrollo
```bash
npm run dev
```
Abrí http://localhost:3000

---

## Estructura del proyecto

```
src/
├── app/
│   ├── page.tsx                  # Página principal — grid de tarjetas
│   ├── rankings/page.tsx         # Rankings de mejor a peor
│   ├── diputados/[id]/page.tsx   # Perfil completo del diputado
│   └── api/
│       ├── diputados/route.ts    # GET /api/diputados
│       ├── diputados/[id]/route.ts  # GET /api/diputados/:id
│       └── rankings/route.ts     # GET /api/rankings
├── components/
│   ├── PoliticianCard.tsx        # Tarjeta estilo SofaScore
│   ├── ScoreBadge.tsx            # Badge de score con colores
│   ├── SearchBar.tsx             # Búsqueda por nombre
│   └── FilterBar.tsx             # Filtros de provincia y orden
├── lib/
│   ├── prisma.ts                 # Cliente de Prisma
│   └── scoreCalculator.ts        # Cálculo de las 11 métricas
├── types/index.ts                # Tipos TypeScript + metadata de métricas
└── scripts/
    └── ingest.ts                 # Ingesta desde Asamblea Open Data CSV
```

## Las 11 métricas

| Código | Nombre | Fuente |
|--------|--------|--------|
| ASI | Asistencia plenario | Asamblea Open Data |
| VOT | Participación votaciones | Asamblea Open Data |
| PRO | Proyectos presentados | Asamblea Open Data |
| APR | Proyectos aprobados | Asamblea Open Data |
| MOC | Mociones | Asamblea Open Data |
| COM | Asistencia comisiones | Asamblea Open Data |
| DEC | Declaración de bienes | CGR |
| GAS | Gasto representación | Asamblea Open Data |
| VIA | Viajes oficiales | Asamblea Open Data |
| ASE | Asesores parlamentarios | Asamblea Open Data |
| COH | Coherencia de voto | Delfino.cr |

## Pesos por dimensión

- **Presencia** (ASI + COM): 15%
- **Productividad** (PRO + APR + MOC): 25%
- **Transparencia** (DEC): 20%
- **Gasto** (GAS + VIA + ASE): 15%
- **Consistencia** (VOT + COH): 15%
- **Ciudadanía**: 10% (Fase 2)

## Cargar CSVs reales de la Asamblea

1. Descargá los CSVs desde https://www.asamblea.go.cr/opendata
2. Colocálos en `/data/`:
   - `asistencia.csv`
   - `votaciones.csv`
   - `proyectos.csv`
   - `viajes.csv`
   - `asesores.csv`
3. Implementá el parser en `src/scripts/ingest.ts` (hay un TODO marcado)
4. Corré `npm run ingest`

## Deploy

### Vercel + Railway

1. Push a GitHub
2. Conectar repo en Vercel
3. Crear DB en Railway → copiar `DATABASE_URL` → agregar en Vercel Environment Variables
4. `vercel deploy`

## Fases

- **Fase 1** ✅ MVP: Diputados 2026–2030, tarjetas, rankings, búsqueda
- **Fase 2** 🔜: Histórico 2022–2026 (Delfino.cr + Asamblea)
- **Fase 3** 🔜: Alcaldes (CGR + Munis.cr)
- **Fase 4** 🔜: Poder Ejecutivo
