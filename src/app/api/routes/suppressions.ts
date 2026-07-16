import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const suppressions = await db.suppression.findMany({
      include: {
        contact: {
          include: { company: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(suppressions);
  } catch (error) {
    console.error('Suppressions error:', error);
    return NextResponse.json(
      { error: 'Failed to load suppressions' },
      { status: 500 }
    );
  }
}