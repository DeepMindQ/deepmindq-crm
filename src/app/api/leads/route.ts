import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const contacts = await db.contact.findMany({
    include: { company: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(contacts);
}