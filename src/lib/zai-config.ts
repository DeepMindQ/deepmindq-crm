/**
 * Ensures .z-ai-config exists for the z-ai-web-dev-sdk.
 * 
 * Priority order:
 * 1. Environment variables (ZAI_BASE_URL, ZAI_API_KEY) — always wins on Vercel
 * 2. Existing .z-ai-config file — used for local development
 * 
 * On Vercel/serverless, env vars override any committed config file
 * because the committed file may have internal-api URLs that aren't
 * reachable from Vercel's network.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

let ensured = false;

export async function ensureZaiConfig(): Promise<void> {
  if (ensured) return;

  // PRIORITY 1: Environment variables — always use these if available
  // This ensures Vercel uses the public api.z.ai URL even if the
  // committed .z-ai-config has internal-api.z.ai
  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;
  const token = process.env.ZAI_TOKEN;
  const chatId = process.env.ZAI_CHAT_ID;
  const userId = process.env.ZAI_USER_ID;

  if (baseUrl && apiKey) {
    const config: Record<string, string> = { baseUrl, apiKey };
    if (token) config.token = token;
    if (chatId) config.chatId = chatId;
    if (userId) config.userId = userId;

    const configStr = JSON.stringify(config);

    // Always write from env vars — overwrite any stale committed file
    const writePaths = [
      path.join(process.cwd(), '.z-ai-config'),
      '/tmp/.z-ai-config',
    ];

    for (const p of writePaths) {
      try {
        await fs.writeFile(p, configStr);
        console.log(`[zai-config] Written from environment variables to ${p}`);
        break;
      } catch {
        // Try next path
      }
    }

    ensured = true;
    return;
  }

  // PRIORITY 2: Check existing config file (local dev fallback)
  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
  ];

  for (const p of configPaths) {
    try {
      const content = await fs.readFile(p, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.baseUrl && parsed.apiKey) {
        ensured = true;
        return;
      }
    } catch {
      // Continue checking
    }
  }

  console.error('[zai-config] No config found — neither env vars nor .z-ai-config file');
  ensured = true;
}