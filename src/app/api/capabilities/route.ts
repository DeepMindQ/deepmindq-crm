import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';

    const where: Prisma.CapabilityAssetWhereInput = {};
    if (category) {
      where.category = category;
    }

    const capabilities = await db.capabilityAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(capabilities);
  } catch (error) {
    console.error('Capabilities error:', error);
    return NextResponse.json(
      { error: 'Failed to load capabilities' },
      { status: 500 }
    );
  }
}