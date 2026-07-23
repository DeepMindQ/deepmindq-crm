import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { apiError, apiSuccess, safeInt, validateBody, sanitize } from "@/lib/apiHelpers";
import { createNoteSchema } from "@/lib/validations";

type NoteWithCompany = Prisma.CompanyNoteGetPayload<{ include: { company: true } }>;
type NoteWithContact = Prisma.ContactNoteGetPayload<{ include: { contact: true } }>;
type NoteListItem = NoteWithCompany & { _type: "company" } | (NoteWithContact & { _type: "contact" });

// ─── GET ────────────────────────────────────────────────────────────────────
// List notes. Query params: companyId, contactId, limit (default 50).
// Returns notes with their company or contact relation included.
// If BOTH companyId AND contactId are provided, uses OR condition (fixes MEDIUM-04).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const contactId = searchParams.get("contactId");
    const limit = Math.min(200, Math.max(1, safeInt(searchParams.get("limit"), 50, 10)));

    const results: NoteListItem[] = [];

    // Both companyId AND contactId → fetch both with OR, single query each
    if (companyId && contactId) {
      const [companyNotes, contactNotes] = await Promise.all([
        db.companyNote.findMany({
          where: { companyId },
          include: { company: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
        db.contactNote.findMany({
          where: { contactId },
          include: { contact: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
      ]);
      for (const note of companyNotes) {
        results.push({ ...note, _type: "company" as const });
      }
      for (const note of contactNotes) {
        results.push({ ...note, _type: "contact" as const });
      }
    } else if (companyId) {
      const companyNotes = await db.companyNote.findMany({
        where: { companyId },
        include: { company: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      for (const note of companyNotes) {
        results.push({ ...note, _type: "company" as const });
      }
    } else if (contactId) {
      const contactNotes = await db.contactNote.findMany({
        where: { contactId },
        include: { contact: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      for (const note of contactNotes) {
        results.push({ ...note, _type: "contact" as const });
      }
    } else {
      // No filter → fetch both and combine
      const [companyNotes, contactNotes] = await Promise.all([
        db.companyNote.findMany({
          include: { company: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
        db.contactNote.findMany({
          include: { contact: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
      ]);
      for (const note of companyNotes) {
        results.push({ ...note, _type: "company" as const });
      }
      for (const note of contactNotes) {
        results.push({ ...note, _type: "contact" as const });
      }
    }

    // Sort combined results by createdAt descending and apply limit
    results.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    return apiSuccess(results.slice(0, limit));
  } catch (error) {
    console.error("Failed to fetch notes:", error);
    return apiError("Failed to fetch notes", 500);
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────
// Create a note. Body: { companyId | contactId, body (required), noteType? }
// Creates a TimelineEntry after note creation.
export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = validateBody(createNoteSchema, raw);
    if (parsed instanceof Response) {
      return parsed;
    }

    const { companyId, contactId, body: noteBody, noteType } = parsed;
    const safeBody = sanitize(noteBody);

    let note: NoteWithCompany | NoteWithContact | null = null;
    let noteTypeStr = noteType ?? null;

    if (companyId) {
      const company = await db.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return apiError("Company not found", 404);
      }

      note = await db.companyNote.create({
        data: {
          companyId,
          body: safeBody,
          // noteType not a field on CompanyNote; store in metadata if needed
        },
        include: { company: true },
      });

      await db.companyTimelineEvent.create({
        data: {
          companyId,
          eventType: "note_added",
          title: "Note added",
          description: `New note added to "${company.rawName}"`,
        },
      });
    } else if (contactId) {
      const contact = await db.contact.findUnique({
        where: { id: contactId },
        include: { company: true },
      });
      if (!contact) {
        return apiError("Contact not found", 404);
      }

      note = await db.contactNote.create({
        data: {
          contactId,
          body: safeBody,
        },
        include: { contact: true },
      });

      await db.companyTimelineEvent.create({
        data: {
          companyId: contact.companyId,
          eventType: "note_added",
          title: "Note added",
          description: `New note added to contact "${contact.rawName}"`,
          metadata: JSON.stringify({ contactId }),
        },
      });
    }

    return apiSuccess({ ...note, _type: companyId ? "company" : "contact" }, 201);
  } catch (error) {
    console.error("Failed to create note:", error);
    return apiError("Failed to create note", 500);
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────────
// Delete a note by ID. Query param: id.
// Auto-detects whether it's a CompanyNote or ContactNote.
// Creates a TimelineEntry for the deletion.
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Note ID is required");
    }

    // Try to find and delete as CompanyNote first
    const companyNote = await db.companyNote.findUnique({ where: { id } });
    if (companyNote) {
      await db.companyNote.delete({ where: { id } });
      await db.companyTimelineEvent.create({
        data: {
          companyId: companyNote.companyId,
          eventType: "note_added",
          title: "Note deleted",
          description: "A note was deleted",
        },
      });
      return apiSuccess({ success: true });
    }

    // Try to find and delete as ContactNote
    const contactNote = await db.contactNote.findUnique({ where: { id } });
    if (contactNote) {
      // Fetch contact to get companyId for the timeline entry
      const contact = await db.contact.findUnique({ where: { id: contactNote.contactId } });
      await db.contactNote.delete({ where: { id } });
      await db.companyTimelineEvent.create({
        data: {
          companyId: contact?.companyId ?? "",
          eventType: "note_added",
          title: "Note deleted",
          description: "A note was deleted",
          metadata: JSON.stringify({ contactId: contactNote.contactId }),
        },
      });
      return apiSuccess({ success: true });
    }

    return apiError("Note not found", 404);
  } catch (error) {
    console.error("Failed to delete note:", error);
    return apiError("Failed to delete note", 500);
  }
}
