import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const provincia = searchParams.get("provincia") ?? "";
  const partido = searchParams.get("partido") ?? "";

  const scores = await prisma.score.findMany({
    include: {
      period: {
        include: {
          politician: true,
        },
      },
    },
    orderBy: { overall: "desc" },
  });

  const rankings = scores
    .map((score, index) => ({
      rank: index + 1,
      id: score.period.politician.id,
      fullName: score.period.politician.fullName,
      party: score.period.politician.party,
      province: score.period.politician.province,
      photoUrl: score.period.politician.photoUrl,
      overall: score.overall,
      ASI: score.ASI,
      VOT: score.VOT,
      PRO: score.PRO,
      DEC: score.DEC,
    }))
    .filter(
      (r) =>
        (!provincia || r.province.toLowerCase().includes(provincia.toLowerCase())) &&
        (!partido || r.party.toLowerCase().includes(partido.toLowerCase()))
    );

  // Re-rank after filter
  rankings.forEach((r, i) => (r.rank = i + 1));

  return Response.json({ data: rankings, total: rankings.length });
}
