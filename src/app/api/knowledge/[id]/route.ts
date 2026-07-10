import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    const doc = await prisma.capabilityDocument.findUnique({
      where: { id },
      include: { snippets: { orderBy: { createdAt: 'desc' } } },
    })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(doc)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    // Delete snippets first
    await prisma.capabilitySnippet.deleteMany({ where: { documentId: id } })
    await prisma.capabilityDocument.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}