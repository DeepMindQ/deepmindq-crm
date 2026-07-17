/**
 * Ensures .z-ai-config exists for the z-ai-web-dev-sdk.
 * On Vercel/serverless, the config file isn't in the filesystem,
 * so we write it from environment variables at first use.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

let ensured = false;

export async function ensureZaiConfig(): Promise<void> {
  if (ensured) return;

  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
  ];

  // Check if config already exists in any expected location
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

  // Build config from environment variables (for Vercel / serverless)
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

    // Write to cwd (works in most serverless environments)
    try {
      await fs.writeFile(
        path.join(process.cwd(), '.z-ai-config'),
        JSON.stringify(config, null, 2)
      );
      console.log('[zai-config] Written from environment variables');
    } catch (err) {
      // If cwd is read-only, try /tmp
      try {
        const tmpPath = '/tmp/.z-ai-config';
        await fs.writeFile(tmpPath, JSON.stringify(config, null, 2));
        console.log('[zai-config] Written to /tmp from environment variables');
      } catch {
        console.error('[zai-config] Failed to write config file');
      }
    }
  }

  ensured = true;
}