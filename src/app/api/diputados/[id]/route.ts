import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { METRIC_META } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const politician = await prisma.politician.findUnique({
    where: { id },
    include: {
      periods: {
        orderBy: { startDate: "desc" },
        include: { score: true },
      },
    },
  });

  if (!politician) {
    return Response.json({ error: "Diputado no encontrado" }, { status: 404 });
  }

  const periods = politician.periods.map((period) => {
    const score = period.score;
    const metricsWithMeta = score
      ? Object.entries(METRIC_META).map(([code, meta]) => ({
          code,
          label: meta.label,
          description: meta.description,
          source: meta.source,
          value: score[code as keyof typeof score] as number,
          weight: meta.weight,
          higherIsBetter: meta.higherIsBetter,
          rawData: (score.rawData as Record<string, unknown>)[code] ?? null,
        }))
      : [];

    return {
      id: period.id,
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      party: period.party,
      score: score
        ? {
            overall: score.overall,
            metrics: metricsWithMeta,
            rawData: score.rawData,
            updatedAt: score.updatedAt.toISOString(),
          }
        : null,
    };
  });

  return Response.json({
    id: politician.id,
    fullName: politician.fullName,
    type: politician.type,
    party: politician.party,
    province: politician.province,
    photoUrl: politician.photoUrl,
    active: politician.active,
    periods,
  });
}
