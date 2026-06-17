import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/diputados/:id/historial
 *
 * Devuelve los snapshots de score del diputado en orden cronológico.
 * Query params:
 *   days=90    → últimos N días (default 90)
 *   limit=100  → máx de snapshots (default 100)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const days = parseInt(searchParams.get("days") ?? "90");
  const limit = parseInt(searchParams.get("limit") ?? "100");

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Buscar el score del período activo del diputado
  const period = await prisma.period.findFirst({
    where: { politicianId: id },
    orderBy: { startDate: "desc" },
    include: {
      score: {
        include: {
          snapshots: {
            where: { takenAt: { gte: since } },
            orderBy: { takenAt: "asc" },
            take: limit,
          },
        },
      },
    },
  });

  if (!period?.score) {
    return Response.json({ data: [], meta: { total: 0, days } });
  }

  const snapshots = period.score.snapshots.map((s) => ({
    id: s.id,
    takenAt: s.takenAt.toISOString(),
    source: s.source,
    overall: s.overall,
    deltaOverall: s.deltaOverall,
    metrics: {
      ASI: s.ASI, COM: s.COM, PRO: s.PRO, APR: s.APR,
      MOC: s.MOC, DEC: s.DEC, GAS: s.GAS, VIA: s.VIA,
      ASE: s.ASE, VOT: s.VOT, COH: s.COH,
    },
  }));

  // Calcular tendencia general del período consultado
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const periodDelta = first && last && first.id !== last.id
    ? Math.round((last.overall - first.overall) * 10) / 10
    : null;

  return Response.json({
    data: snapshots,
    meta: {
      total: snapshots.length,
      days,
      periodDelta,        // cambio neto del período
      currentOverall: period.score.overall,
    },
  });
}
