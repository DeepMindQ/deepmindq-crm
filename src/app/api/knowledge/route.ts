import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    const docs = await prisma.capabilityDocument.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { snippets: true } } },
    })
    return NextResponse.json(docs)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    const fd = await req.formData()
    const file = fd.get('file') as File
    const title = (fd.get('title') as string) || file?.name?.replace(/\.[^.]+$/, '') || 'Untitled'
    const description = (fd.get('description') as string) || ''
    const content = await file.text()
    const docType = file?.name?.split('.').pop()?.toUpperCase() || 'TXT'
    const doc = await prisma.capabilityDocument.create({
      data: { title, docType, description, content, fileName: file?.name || 'unknown.txt' },
    })
    return NextResponse.json(doc, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}