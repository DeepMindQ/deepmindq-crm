import { NextRequest } from "next/server"

async function GET(_request: NextRequest) {
  return new Response(JSON.stringify({ message: "Auth endpoint - use mock auth" }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function POST(_request: NextRequest) {
  return new Response(JSON.stringify({ message: "Auth endpoint - use mock auth" }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

export { GET, POST }