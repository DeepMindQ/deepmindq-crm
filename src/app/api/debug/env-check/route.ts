import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET() {
  const env = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? `SET (${process.env.GEMINI_API_KEY.slice(0, 8)}...)` : 'MISSING',
    GEMINI_BASE_URL: process.env.GEMINI_BASE_URL || 'MISSING',
    TAVILY_API_KEY: process.env.TAVILY_API_KEY ? `SET (${process.env.TAVILY_API_KEY.slice(0, 8)}...)` : 'MISSING',
  }

  let tavilyStatus = 'not tested'
  if (process.env.TAVILY_API_KEY) {
    try {
      const r = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: 'test', max_results: 1 }),
      })
      tavilyStatus = r.ok ? 'OK' : `ERROR ${r.status}`
    } catch (e: any) { tavilyStatus = `FETCH ERROR: ${e.message}` }
  }

  let geminiStatus = 'not tested'
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_BASE_URL) {
    try {
      const r = await fetch(`${process.env.GEMINI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GEMINI_API_KEY}` },
        body: JSON.stringify({ model: 'gemini-2.0-flash', messages: [{ role: 'user', content: 'say ok' }], max_tokens: 5 }),
      })
      const data = await r.json()
      geminiStatus = r.ok ? `OK: ${(data.choices?.[0]?.message?.content || '').slice(0, 50)}` : `ERROR ${r.status}: ${JSON.stringify(data).slice(0, 200)}`
    } catch (e: any) { geminiStatus = `FETCH ERROR: ${e.message}` }
  }

  return NextResponse.json({ env, tavilyStatus, geminiStatus, timestamp: new Date().toISOString() })
}
