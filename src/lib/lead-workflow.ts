/* ═══════════════════════════════════════════════════
   L-07: Lead Status Workflow Management
   
   Defines valid status transitions and provides
   validation/execution functions.
   ═══════════════════════════════════════════════════ */

const TRANSITIONS: Record<string, string[]> = {
  imported:   ['cleaned', 'duplicate', 'archived'],
  cleaned:    ['drafted', 'archived'],
  drafted:    ['queued', 'rejected'],
  rejected:   ['cleaned'],    // rejected → back to cleaned
  queued:     ['sent', 'failed', 'cancelled'],
  failed:     ['queued', 'cancelled'],   // retry
  cancelled:  ['cleaned'],
  sent:       ['replied', 'bounced', 'archived'],
  replied:    ['archived'],
  bounced:    ['suppressed'],
  suppressed: ['archived'],
  archived:   [],   // terminal state
  duplicate:  [],   // terminal state
};

/**
 * Check if a transition from currentStatus to newStatus is valid
 */
export function canTransition(currentStatus: string, newStatus: string): boolean {
  return TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Get all valid transitions from a given status
 */
export function getValidTransitions(status: string): string[] {
  return TRANSITIONS[status] || [];
}

/**
 * Execute a status transition with validation
 */
export async function transitionStatus(
  contactId: string,
  newStatus: string,
  _reason?: string,
): Promise<{ success: boolean; error?: string }> {
  const { db } = await import('@/lib/db');

  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) {
    return { success: false, error: 'Contact not found' };
  }

  if (!canTransition(contact.status, newStatus)) {
    const valid = getValidTransitions(contact.status);
    return {
      success: false,
      error: `Cannot transition from "${contact.status}" to "${newStatus}". Valid: ${valid.join(', ') || 'none'}`,
    };
  }

  const updateData: any = { status: newStatus };

  // Special handling for bounced → suppressed
  if (newStatus === 'suppressed') {
    updateData.isSuppressed = true;
  }

  await db.contact.update({
    where: { id: contactId },
    data: updateData,
  });

  return { success: true };
}

/**
 * Get all possible statuses
 */
export function getAllStatuses(): string[] {
  return Object.keys(TRANSITIONS);
}