import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";

export async function GET() {
  try {
    const MAX_FILTER_OPTIONS = 200;

    const [industries, countries] = await Promise.all([
      db.company.findMany({
        where: { status: { not: "archived" }, industry: { not: null } },
        distinct: ["industry"],
        select: { industry: true },
        orderBy: { industry: "asc" },
        take: MAX_FILTER_OPTIONS,
      }),
      db.company.findMany({
        where: { status: { not: "archived" }, country: { not: null } },
        distinct: ["country"],
        select: { country: true },
        orderBy: { country: "asc" },
        take: MAX_FILTER_OPTIONS,
      }),
    ]);

    return apiSuccess({
      industries: industries.map((i) => i.industry).filter(Boolean) as string[],
      countries: countries.map((c) => c.country).filter(Boolean) as string[],
    });
  } catch (error) {
    console.error("Failed to fetch filter metadata:", error);
    return apiError("Failed to fetch filter metadata", 500);
  }
}