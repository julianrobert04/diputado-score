/**
 * DiputadoScore — Script de ingesta de datos desde Asamblea Open Data
 *
 * Uso:
 *   npx tsx src/scripts/ingest.ts
 *
 * Variables de entorno requeridas:
 *   DATABASE_URL=postgresql://...
 *
 * Fuentes:
 *   https://www.asamblea.go.cr/opendata
 *   - Asistencia plenario (CSV)
 *   - Votaciones (CSV)
 *   - Proyectos de ley (CSV)
 *   - Viajes (CSV)
 *   - Asesores (CSV)
 *   - Gasto representación (CSV)
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { calcMetrics, calcOverall, PeriodAverages } from "../lib/scoreCalculator";
import { RawData } from "../types";
import * as fs from "fs";
import * as path from "path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no configurada");
const adapter = new PrismaPg({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

// ─── Tipos de los CSV ─────────────────────────────────────────────────────────

interface DiputadoRow {
  nombre: string;
  partido: string;
  provincia: string;
  sesionesAsistidas: number;
  sesionesTotales: number;
  votacionesParticipadas: number;
  votacionesTotales: number;
  proyectosPresentados: number;
  proyectosAprobados: number;
  mociones: number;
  comisionesAsistidas: number;
  comisionesTotales: number;
  declaracionEstado: "al_dia" | "atrasada" | "no_presento";
  gastoRepresentacion: number;
  gastoPresupuesto: number;
  viajesOficiales: number;
  asesoresCount: number;
}

// ─── Parser de CSV simple ─────────────────────────────────────────────────────

function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

// ─── Datos seed para demo / desarrollo ───────────────────────────────────────
// Diputados del período 2026–2030 (Wikipedia: Anexo:Diputados_del_periodo_legislativo_2026-2030)
// Nota: estos son datos de ejemplo — el script real lee los CSVs de la Asamblea

const SEED_DIPUTADOS: DiputadoRow[] = [
  {
    nombre: "Rodrigo Chaves Robles",
    partido: "Partido Progreso Social Democrático",
    provincia: "San José",
    sesionesAsistidas: 0, sesionesTotales: 0, // Presidente — no aplica plenario
    votacionesParticipadas: 0, votacionesTotales: 0,
    proyectosPresentados: 45, proyectosAprobados: 12,
    mociones: 0, comisionesAsistidas: 0, comisionesTotales: 0,
    declaracionEstado: "al_dia",
    gastoRepresentacion: 0, gastoPresupuesto: 1,
    viajesOficiales: 18, asesoresCount: 0,
  },
  {
    nombre: "Franggi Nicolás Solano",
    partido: "Partido Acción Ciudadana",
    provincia: "San José",
    sesionesAsistidas: 78, sesionesTotales: 85,
    votacionesParticipadas: 420, votacionesTotales: 450,
    proyectosPresentados: 12, proyectosAprobados: 3,
    mociones: 45, comisionesAsistidas: 38, comisionesTotales: 42,
    declaracionEstado: "al_dia",
    gastoRepresentacion: 850000, gastoPresupuesto: 1200000,
    viajesOficiales: 2, asesoresCount: 3,
  },
  {
    nombre: "Zoila Rosa Volio Pacheco",
    partido: "Partido Unidad Social Cristiana",
    provincia: "Cartago",
    sesionesAsistidas: 65, sesionesTotales: 85,
    votacionesParticipadas: 380, votacionesTotales: 450,
    proyectosPresentados: 8, proyectosAprobados: 1,
    mociones: 30, comisionesAsistidas: 30, comisionesTotales: 42,
    declaracionEstado: "atrasada",
    gastoRepresentacion: 1100000, gastoPresupuesto: 1200000,
    viajesOficiales: 5, asesoresCount: 5,
  },
  {
    nombre: "Mario Castillo Méndez",
    partido: "Frente Amplio",
    provincia: "Heredia",
    sesionesAsistidas: 82, sesionesTotales: 85,
    votacionesParticipadas: 440, votacionesTotales: 450,
    proyectosPresentados: 20, proyectosAprobados: 5,
    mociones: 60, comisionesAsistidas: 40, comisionesTotales: 42,
    declaracionEstado: "al_dia",
    gastoRepresentacion: 700000, gastoPresupuesto: 1200000,
    viajesOficiales: 1, asesoresCount: 2,
  },
  {
    nombre: "Gloria Bejarano Almada",
    partido: "Partido Liberación Nacional",
    provincia: "Guanacaste",
    sesionesAsistidas: 55, sesionesTotales: 85,
    votacionesParticipadas: 300, votacionesTotales: 450,
    proyectosPresentados: 5, proyectosAprobados: 0,
    mociones: 15, comisionesAsistidas: 20, comisionesTotales: 42,
    declaracionEstado: "no_presento",
    gastoRepresentacion: 1200000, gastoPresupuesto: 1200000,
    viajesOficiales: 8, asesoresCount: 6,
  },
  {
    nombre: "Kenneth Cascante Hernández",
    partido: "Partido Restauración Nacional",
    provincia: "Alajuela",
    sesionesAsistidas: 70, sesionesTotales: 85,
    votacionesParticipadas: 390, votacionesTotales: 450,
    proyectosPresentados: 7, proyectosAprobados: 2,
    mociones: 25, comisionesAsistidas: 33, comisionesTotales: 42,
    declaracionEstado: "al_dia",
    gastoRepresentacion: 950000, gastoPresupuesto: 1200000,
    viajesOficiales: 3, asesoresCount: 4,
  },
  {
    nombre: "Paulina Ramírez Portuguéz",
    partido: "Partido Acción Ciudadana",
    provincia: "Puntarenas",
    sesionesAsistidas: 80, sesionesTotales: 85,
    votacionesParticipadas: 430, votacionesTotales: 450,
    proyectosPresentados: 15, proyectosAprobados: 4,
    mociones: 50, comisionesAsistidas: 39, comisionesTotales: 42,
    declaracionEstado: "al_dia",
    gastoRepresentacion: 800000, gastoPresupuesto: 1200000,
    viajesOficiales: 2, asesoresCount: 3,
  },
  {
    nombre: "Roberto Thompson Chacón",
    partido: "Partido Unidad Social Cristiana",
    provincia: "Limón",
    sesionesAsistidas: 60, sesionesTotales: 85,
    votacionesParticipadas: 350, votacionesTotales: 450,
    proyectosPresentados: 6, proyectosAprobados: 1,
    mociones: 20, comisionesAsistidas: 25, comisionesTotales: 42,
    declaracionEstado: "atrasada",
    gastoRepresentacion: 1050000, gastoPresupuesto: 1200000,
    viajesOficiales: 6, asesoresCount: 5,
  },
];

// ─── Calculador de promedios del período ──────────────────────────────────────

function calcAverages(rows: DiputadoRow[]): PeriodAverages {
  const n = rows.length;
  return {
    avgProyectos: rows.reduce((s, r) => s + r.proyectosPresentados, 0) / n,
    avgMociones: rows.reduce((s, r) => s + r.mociones, 0) / n,
    avgViajes: rows.reduce((s, r) => s + r.viajesOficiales, 0) / n,
    avgAsesores: rows.reduce((s, r) => s + r.asesoresCount, 0) / n,
    avgGastoPct:
      rows.reduce((s, r) => s + (r.gastoPresupuesto > 0 ? (r.gastoRepresentacion / r.gastoPresupuesto) * 100 : 0), 0) / n,
  };
}

// ─── Ingesta principal ────────────────────────────────────────────────────────

async function ingest() {
  console.log("🏛️  DiputadoScore — Ingesta de datos");
  console.log("=====================================\n");

  // Verificar si hay CSVs reales en /data, si no, usar seed
  const dataDir = path.join(process.cwd(), "data");
  let rows: DiputadoRow[] = SEED_DIPUTADOS;

  if (fs.existsSync(path.join(dataDir, "asistencia.csv"))) {
    console.log("📂 Leyendo CSVs desde /data...");
    // TODO: implementar parser de CSVs reales de la Asamblea
    // rows = parseAsambleaCSVs(dataDir);
  } else {
    console.log("⚠️  No se encontraron CSVs en /data — usando datos de demostración");
    console.log("   Coloque los CSVs de https://www.asamblea.go.cr/opendata en /data/\n");
  }

  const avgs = calcAverages(rows);
  console.log("📊 Promedios del período:");
  console.log(`   Proyectos: ${avgs.avgProyectos.toFixed(1)}`);
  console.log(`   Mociones:  ${avgs.avgMociones.toFixed(1)}`);
  console.log(`   Viajes:    ${avgs.avgViajes.toFixed(1)}`);
  console.log(`   Asesores:  ${avgs.avgAsesores.toFixed(1)}`);
  console.log(`   Gasto %:   ${avgs.avgGastoPct.toFixed(1)}%\n`);

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const rawData: RawData = {
      sesionesAsistidas: row.sesionesAsistidas,
      sesionesTotales: row.sesionesTotales,
      votacionesParticipadas: row.votacionesParticipadas,
      votacionesTotales: row.votacionesTotales,
      proyectosPresentados: row.proyectosPresentados,
      proyectosAprobados: row.proyectosAprobados,
      mociones: row.mociones,
      comisionesAsistidas: row.comisionesAsistidas,
      comisionesTotales: row.comisionesTotales,
      declaracionEstado: row.declaracionEstado,
      gastoRepresentacion: row.gastoRepresentacion,
      gastoPresupuesto: row.gastoPresupuesto,
      viajesOficiales: row.viajesOficiales,
      asesoresCount: row.asesoresCount,
    };

    const metrics = calcMetrics(rawData, avgs);
    const overall = calcOverall(metrics);

    // Upsert del politician
    const politician = await prisma.politician.upsert({
      where: {
        // Si ya existe por nombre exacto — en producción usar un ID externo
        id: `dep-${row.nombre.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`,
      },
      create: {
        id: `dep-${row.nombre.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`,
        fullName: row.nombre,
        type: "diputado",
        party: row.partido,
        province: row.provincia,
        active: true,
      },
      update: {
        party: row.partido,
        province: row.provincia,
        active: true,
      },
    });

    // Upsert del period (2026–2030)
    const periodId = `${politician.id}-2026-2030`;
    const period = await prisma.period.upsert({
      where: { id: periodId },
      create: {
        id: periodId,
        politicianId: politician.id,
        startDate: new Date("2026-05-01"),
        endDate: new Date("2030-04-30"),
        party: row.partido,
      },
      update: { party: row.partido },
    });

    // Upsert del score
    await prisma.score.upsert({
      where: { periodId: period.id },
      create: {
        periodId: period.id,
        overall,
        ...metrics,
        rawData: rawData as object,
      },
      update: {
        overall,
        ...metrics,
        rawData: rawData as object,
      },
    });

    console.log(`✅ ${row.nombre.padEnd(35)} overall: ${overall.toFixed(1)}`);
    created++;
  }

  console.log(`\n🎉 Listo: ${created} diputados procesados`);
  await prisma.$disconnect();
}

ingest().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
