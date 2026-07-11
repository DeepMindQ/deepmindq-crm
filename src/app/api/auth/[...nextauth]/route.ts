import { NextRequest } from "next/server"
import { handlers } from "@/lib/auth"

async function GET(request: NextRequest, _context: { params: Promise<{ nextauth: string[] }> }) {
  return handlers.GET(request as any) as unknown as Response
}

async function POST(request: NextRequest, _context: { params: Promise<{ nextauth: string[] }> }) {
  return handlers.POST(request as any) as unknown as Response
}

export { GET, POST }