/**
 * Prompt Templates Management API — DeepMindQ Intelligence OS
 *
 * GET  /api/prompt-templates?feature=reasoning&isActive=true
 * POST /api/prompt-templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { invalidatePromptCache } from '@/lib/prompt-registry';

// ─── Query Schemas ──────────────────────────────────────────────────

const listQuerySchema = z.object({
  feature: z.string().max(100).optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  page: z.coerce.number().int().min(1).default(1),
});

const createPromptSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z][a-z0-9_]*$/, 'Key must be snake_case, starting with a letter'),
  label: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().min(1).max(50000),
  userPromptTemplate: z.string().max(50000).optional(),
  feature: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

// ─── GET: List prompt templates ─────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { feature, isActive, limit, page } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (feature !== undefined) where.feature = feature;
    if (isActive !== undefined) where.isActive = isActive;

    const [templates, total] = await Promise.all([
      db.promptTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ key: 'asc' }, { version: 'desc' }],
      }),
      db.promptTemplate.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to list prompt templates', details: message },
      { status: 500 },
    );
  }
}

// ─── POST: Create a new prompt template version ─────────────────────

export async function POST(request: NextRequest) {
  try {
    const { errorResponse, session } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = createPromptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Determine version number: if templates already exist for this key,
    // auto-increment the version.
    const existing = await db.promptTemplate.findMany({
      where: { key: data.key },
      orderBy: { version: 'desc' },
      take: 1,
    });

    const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1;

    const template = await db.promptTemplate.create({
      data: {
        key: data.key,
        label: data.label,
        description: data.description,
        systemPrompt: data.systemPrompt,
        userPromptTemplate: data.userPromptTemplate,
        version: nextVersion,
        isActive: data.isActive,
        isDefault: data.isDefault,
        feature: data.feature,
        model: data.model,
        createdBy: session?.id,
      },
    });

    // Invalidate the in-memory cache so the new prompt is picked up
    invalidatePromptCache(data.key);

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create prompt template', details: message },
      { status: 500 },
    );
  }
}
