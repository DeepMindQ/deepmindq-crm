import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [industries, countries] = await Promise.all([
      db.company.findMany({
        where: { status: { not: "archived" }, industry: { not: null } },
        distinct: ["industry"],
        select: { industry: true },
        orderBy: { industry: "asc" },
      }),
      db.company.findMany({
        where: { status: { not: "archived" }, country: { not: null } },
        distinct: ["country"],
        select: { country: true },
        orderBy: { country: "asc" },
      }),
    ]);

    return NextResponse.json({
      industries: industries.map((i) => i.industry).filter(Boolean) as string[],
      countries: countries.map((c) => c.country).filter(Boolean) as string[],
    });
  } catch (error) {
    console.error("Failed to fetch filter metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch filter metadata" },
      { status: 500 }
    );
  }
}