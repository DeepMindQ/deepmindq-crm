import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const docs = await db.capabilityDocument.findMany({
    include: { snippets: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(docs);
}

export async function POST(req: Request) {
  const body = await req.json();
  const doc = await db.capabilityDocument.create({
    data: {
      title: body.title,
      docType: body.docType,
      description: body.description,
      content: body.content,
    },
  });
  return NextResponse.json(doc);
}