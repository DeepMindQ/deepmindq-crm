import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const ACTION_LABELS: Record<string, string> = {
  login: 'Signed in',
  view_organization: 'Viewed company profile',
  search: 'Performed search',
  create_briefing: 'Generated briefing',
  analyze_signal: 'Analyzed signal',
  export_data: 'Exported data',
  update_settings: 'Updated settings',
  dismiss_signal: 'Dismissed signal',
};

const ACTION_ICONS: Record<string, string> = {
  login: 'log_in',
  view_organization: 'building',
  search: 'search',
  create_briefing: 'document',
  analyze_signal: 'activity',
  export_data: 'download',
  update_settings: 'settings',
  dismiss_signal: 'x_circle',
};

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { limit } = parsed.data;

    const auditLogs = await db.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    // Fetch users separately since AuditLog has no Prisma relation to User
    const userIds = [
      ...new Set(auditLogs.map((log) => log.userId).filter((id): id is string => !!id)),
    ];
    const users =
      userIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const activities = auditLogs.map((log) => {
      const actionLabel = ACTION_LABELS[log.action] || log.action;
      const icon = ACTION_ICONS[log.action] || 'circle';
      const matchedUser = log.userId ? userMap.get(log.userId) : null;

      return {
        id: log.id,
        user: matchedUser ? { name: matchedUser.name, email: matchedUser.email } : null,
        action: log.action,
        actionLabel,
        icon,
        resource: log.resource,
        details: log.details,
        timestamp: log.createdAt,
      };
    });

    return NextResponse.json({ data: activities });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch team activity' }, { status: 500 });
  }
}
