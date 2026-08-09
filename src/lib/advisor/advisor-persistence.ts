/**
 * MS9 Integration Layer — Advisor Persistence
 * ==============================================
 *
 * Enterprise-grade persistence for advisor conversations, messages,
 * workspaces, and escalations. Uses Prisma models for structured storage.
 *
 * This enables:
 *   - Conversation history across sessions
 *   - Saved briefings in workspace
 *   - Workspace persistence
 *   - Human escalation workflow tracking
 *
 * Without persistence, the advisor remains a session-only demo.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { AdvisorWorkspace, WorkspaceItem } from '@/types/ms9-advisor';

// ─── Conversation Persistence ─────────────────────────────────────

export interface CreateConversationInput {
  title?: string;
  scope?: string;
  companyId?: string;
  userId?: string;
}

export interface AddMessageInput {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** JSON-serialized briefing or message content */
  contentJson?: string;
  /** Briefing ID if this message contains a StructuredBriefing */
  briefingId?: string;
  queryText?: string;
  /** Processing metadata */
  processingDurationMs?: number;
  modelUsed?: string;
}

export interface UpdateWorkspaceInput {
  conversationId: string;
  workspace: AdvisorWorkspace;
}

export interface CreateEscalationInput {
  conversationId: string;
  messageId: string;
  reason: string;
  priority: string;
  description: string;
  /** JSON-serialized context snapshot */
  contextSnapshot: string;
}

// ─── Conversation API ───────────────────────────────────────────

export const advisorConversationApi = {
  /**
   * Create a new advisor conversation.
   * Returns the conversation ID.
   */
  async createConversation(input: CreateConversationInput): Promise<string> {
    try {
      const conversation = await db.advisorConversation.create({
        data: {
          title: input.title || 'New Intelligence Briefing',
          scope: (input.scope || 'general_intelligence') as any,
          companyId: input.companyId,
          userId: input.userId,
          status: 'active',
          messageCount: 0,
        },
      });
      logger.info('advisor:persistence:conversation-created', { id: conversation.id });
      return conversation.id;
    } catch (error) {
      logger.error('advisor:persistence:conversation-create-failed', { error: String(error) });
      throw error;
    }
  },

  /**
   * Retrieve a conversation with all messages.
   */
  async getConversation(conversationId: string) {
    try {
      const conversation = await db.advisorConversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { position: 'asc' },
          },
          escalations: {
            where: { status: { in: ['requested', 'acknowledged', 'in_progress'] } },
            orderBy: { requestedAt: 'desc' },
          },
        },
      });
      return conversation;
    } catch (error) {
      logger.error('advisor:persistence:conversation-get-failed', {
        conversationId,
        error: String(error),
      });
      return null;
    }
  },

  /**
   * List conversations for a company or user.
   */
  async listConversations(options: { companyId?: string; userId?: string; limit?: number }) {
    const { companyId, userId, limit = 20 } = options;
    try {
      const conversations = await db.advisorConversation.findMany({
        where: {
          companyId: companyId || undefined,
          userId: userId || undefined,
          status: 'active',
        },
        orderBy: { lastActiveAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          scope: true,
          messageCount: true,
          lastActiveAt: true,
          createdAt: true,
        },
      });
      return conversations;
    } catch (error) {
      logger.error('advisor:persistence:conversation-list-failed', { error: String(error) });
      return [];
    }
  },

  /**
   * Update conversation metadata (title, message count, last active).
   */
  async updateConversation(
    conversationId: string,
    data: { title?: string; lastActiveAt?: Date },
  ) {
    try {
      await db.advisorConversation.update({
        where: { id: conversationId },
        data,
      });
    } catch (error) {
      logger.error('advisor:persistence:conversation-update-failed', {
        conversationId,
        error: String(error),
      });
    }
  },

  // ─── Message Operations ───────────────────────────────────────

  /**
   * Add a message to a conversation.
   */
  async addMessage(input: AddMessageInput) {
    try {
      // Get current message count for position
      const conversation = await db.advisorConversation.findUnique({
        where: { id: input.conversationId },
        select: { messageCount: true },
      });

      const position = (conversation?.messageCount ?? 0) + 1;

      const message = await db.advisorMessage.create({
        data: {
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          contentJson: input.contentJson,
          briefingId: input.briefingId,
          queryText: input.queryText,
          position,
          processingDurationMs: input.processingDurationMs,
          modelUsed: input.modelUsed,
          status: 'delivered',
        },
      });

      // Update conversation metadata
      await db.advisorConversation.update({
        where: { id: input.conversationId },
        data: {
          messageCount: position,
          lastActiveAt: new Date(),
        },
      });

      return message;
    } catch (error) {
      logger.error('advisor:persistence:message-add-failed', {
        conversationId: input.conversationId,
        error: String(error),
      });
      return null;
    }
  },

  /**
   * Add feedback to a message.
   */
  async addMessageFeedback(messageId: string, feedbackType: string, comment?: string) {
    try {
      await db.advisorMessage.update({
        where: { id: messageId },
        data: {
          feedbackType: feedbackType as any,
          feedbackComment: comment,
          feedbackProvidedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('advisor:persistence:message-feedback-failed', {
        messageId,
        error: String(error),
      });
    }
  },

  // ─── Workspace Operations ────────────────────────────────────

  /**
   * Save workspace state for a conversation.
   */
  async saveWorkspace(input: UpdateWorkspaceInput) {
    try {
      const workspaceJson = JSON.stringify(input.workspace);

      // Upsert the workspace record
      await db.advisorWorkspace.upsert({
        where: {
          conversationId: input.conversationId,
        },
        create: {
          conversationId: input.conversationId,
          workspaceData: workspaceJson,
          totalItems: input.workspace.totalItems,
          updatedAt: new Date(),
        },
        update: {
          workspaceData: workspaceJson,
          totalItems: input.workspace.totalItems,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('advisor:persistence:workspace-save-failed', {
        conversationId: input.conversationId,
        error: String(error),
      });
    }
  },

  /**
   * Load workspace for a conversation.
   */
  async loadWorkspace(conversationId: string): Promise<AdvisorWorkspace | null> {
    try {
      const workspace = await db.advisorWorkspace.findUnique({
        where: { conversationId },
      });
      if (!workspace) return null;

      return JSON.parse(workspace.workspaceData) as AdvisorWorkspace;
    } catch (error) {
      logger.error('advisor:persistence:workspace-load-failed', {
        conversationId,
        error: String(error),
      });
      return null;
    }
  },

  // ─── Escalation Operations ────────────────────────────────────

  /**
   * Create a human escalation request.
   */
  async createEscalation(input: CreateEscalationInput) {
    try {
      const escalation = await db.advisorEscalation.create({
        data: {
          conversationId: input.conversationId,
          messageId: input.messageId,
          reason: input.reason as any,
          priority: input.priority as any,
          description: input.description,
          contextSnapshot: input.contextSnapshot,
          status: 'requested',
        },
      });

      logger.info('advisor:persistence:escalation-created', { id: escalation.id });
      return escalation;
    } catch (error) {
      logger.error('advisor:persistence:escalation-create-failed', {
        conversationId: input.conversationId,
        error: String(error),
      });
      throw error;
    }
  },

  /**
   * Update escalation status.
   */
  async updateEscalationStatus(escalationId: string, status: string) {
    try {
      await db.advisorEscalation.update({
        where: { id: escalationId },
        data: {
          status: status as any,
          acknowledgedAt: status === 'acknowledged' ? new Date() : undefined,
          resolvedAt: status === 'resolved' || status === 'dismissed' ? new Date() : undefined,
        },
      });
    } catch (error) {
      logger.error('advisor:persistence:escalation-update-failed', {
        escalationId,
        error: String(error),
      });
    }
  },

  /**
   * List active escalations for a conversation.
   */
  async listEscalations(conversationId: string) {
    try {
      return await db.advisorEscalation.findMany({
        where: {
          conversationId,
          status: { in: ['requested', 'acknowledged', 'in_progress'] },
        },
        orderBy: { requestedAt: 'desc' },
      });
    } catch (error) {
      logger.error('advisor:persistence:escalation-list-failed', {
        conversationId,
        error: String(error),
      });
      return [];
    }
  },

  // ─── Saved Briefings ─────────────────────────────────────────

  /**
   * Save a briefing to the workspace for later retrieval.
   */
  async saveBriefing(data: {
    conversationId: string;
    title: string;
    briefingJson: string;
    companyId?: string;
  }) {
    try {
      const savedBriefing = await db.advisorSavedBriefing.create({
        data: {
          conversationId: data.conversationId,
          title: data.title,
          briefingData: data.briefingJson,
          companyId: data.companyId,
        },
      });

      logger.info('advisor:persistence:briefing-saved', { id: savedBriefing.id });
      return savedBriefing;
    } catch (error) {
      logger.error('advisor:persistence:briefing-save-failed', { error: String(error) });
      throw error;
    }
  },

  /**
   * List saved briefings.
   */
  async listSavedBriefings(options: { companyId?: string; limit?: number }) {
    const { companyId, limit = 20 } = options;
    try {
      return await db.advisorSavedBriefing.findMany({
        where: { companyId: companyId || undefined },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          companyId: true,
          createdAt: true,
        },
      });
    } catch (error) {
      logger.error('advisor:persistence:briefing-list-failed', { error: String(error) });
      return [];
    }
  },
};
