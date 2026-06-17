import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("q") ?? "";
  const province = searchParams.get("provincia") ?? "";
  const party = searchParams.get("partido") ?? "";
  const sort = searchParams.get("sort") ?? "overall_desc";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "57"); // 57 diputados

  const where: Prisma.PoliticianWhereInput = {
    type: "diputado",
    ...(search && {
      fullName: { contains: search, mode: "insensitive" },
    }),
    ...(province && { province: { contains: province, mode: "insensitive" } }),
    ...(party && { party: { contains: party, mode: "insensitive" } }),
  };

  const politicians = await prisma.politician.findMany({
    where,
    include: {
      periods: {
        orderBy: { startDate: "desc" },
        take: 1,
        include: { score: true },
      },
    },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.politician.count({ where });

  // Mapear a PoliticianCard y ordenar por overall
  const cards = politicians
    .map((p) => {
      const latestPeriod = p.periods[0];
      const score = latestPeriod?.score;
      return {
        id: p.id,
        fullName: p.fullName,
        type: p.type,
        party: p.party,
        province: p.province,
        photoUrl: p.photoUrl,
        active: p.active,
        overall: score?.overall ?? 0,
        metrics: score
          ? {
              ASI: score.ASI,
              COM: score.COM,
              PRO: score.PRO,
              APR: score.APR,
              MOC: score.MOC,
              DEC: score.DEC,
              GAS: score.GAS,
              VIA: score.VIA,
              ASE: score.ASE,
              VOT: score.VOT,
              COH: score.COH,
            }
          : null,
        period: latestPeriod
          ? {
              startDate: latestPeriod.startDate.toISOString(),
              endDate: latestPeriod.endDate.toISOString(),
            }
          : null,
      };
    })
    .sort((a, b) => {
      if (sort === "overall_asc") return a.overall - b.overall;
      if (sort === "overall_desc") return b.overall - a.overall;
      if (sort === "name_asc") return a.fullName.localeCompare(b.fullName);
      if (sort === "name_desc") return b.fullName.localeCompare(a.fullName);
      return b.overall - a.overall;
    });

  return Response.json({
    data: cards,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}
