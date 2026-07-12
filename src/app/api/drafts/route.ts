import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const drafts = await db.draft.findMany({
    include: { contact: { include: { company: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(drafts);
}

export async function PATCH(req: Request) {
  const { id, status, subject, body, rejectReason } = await req.json();
  const draft = await db.draft.update({
    where: { id },
    data: { status, subject, body, rejectReason, updatedAt: new Date().toISOString() },
  });
  return NextResponse.json(draft);
}