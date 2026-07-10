import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ─── GET ────────────────────────────────────────────────────────────────────
// List notes. Query params: companyId, contactId, limit (default 50).
// Returns notes with their company or contact relation included.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const contactId = searchParams.get("contactId");
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);

    const results: unknown[] = [];

    // If companyId is provided, fetch company notes
    if (companyId) {
      const companyNotes = await db.companyNote.findMany({
        where: { companyId },
        include: { company: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      for (const note of companyNotes) {
        results.push({ ...note, _type: "company" as const });
      }
    }

    // If contactId is provided, fetch contact notes
    if (contactId) {
      const contactNotes = await db.contactNote.findMany({
        where: { contactId },
        include: { contact: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      for (const note of contactNotes) {
        results.push({ ...note, _type: "contact" as const });
      }
    }

    // If neither filter is provided, fetch both and combine
    if (!companyId && !contactId) {
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
      (a, b) =>
        new Date((b as { createdAt: string }).createdAt).getTime() -
        new Date((a as { createdAt: string }).createdAt).getTime()
    );

    return NextResponse.json(results.slice(0, limit));
  } catch (error) {
    console.error("Failed to fetch notes:", error);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────
// Create a note. Body: { companyId | contactId, body (required), noteType? }
// Creates a TimelineEntry after note creation.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, contactId, body: noteBody, noteType } = body;

    if (!noteBody || typeof noteBody !== "string" || noteBody.trim().length === 0) {
      return NextResponse.json(
        { error: "Note body is required" },
        { status: 400 }
      );
    }

    if (!companyId && !contactId) {
      return NextResponse.json(
        { error: "Either companyId or contactId is required" },
        { status: 400 }
      );
    }

    let note;

    if (companyId) {
      const company = await db.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 });
      }

      note = await db.companyNote.create({
        data: {
          companyId,
          body: noteBody.trim(),
          noteType: noteType?.trim() || null,
        },
        include: { company: true },
      });

      await db.timelineEntry.create({
        data: {
          companyId,
          action: "note_added",
          details: `New note added to "${company.name}"`,
        },
      });
    } else if (contactId) {
      const contact = await db.contact.findUnique({
        where: { id: contactId },
        include: { company: true },
      });
      if (!contact) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }

      note = await db.contactNote.create({
        data: {
          contactId,
          body: noteBody.trim(),
          noteType: noteType?.trim() || null,
        },
        include: { contact: true },
      });

      await db.timelineEntry.create({
        data: {
          companyId: contact.companyId,
          contactId,
          action: "note_added",
          details: `New note added to contact "${contact.name}"`,
        },
      });
    }

    return NextResponse.json({ ...note, _type: companyId ? "company" : "contact" }, { status: 201 });
  } catch (error) {
    console.error("Failed to create note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
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
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 });
    }

    // Try to find and delete as CompanyNote first
    const companyNote = await db.companyNote.findUnique({ where: { id } });
    if (companyNote) {
      await db.companyNote.delete({ where: { id } });
      await db.timelineEntry.create({
        data: {
          companyId: companyNote.companyId,
          action: "note_deleted",
          details: "A note was deleted",
        },
      });
      return NextResponse.json({ success: true });
    }

    // Try to find and delete as ContactNote
    const contactNote = await db.contactNote.findUnique({ where: { id } });
    if (contactNote) {
      // Fetch contact to get companyId for the timeline entry
      const contact = await db.contact.findUnique({ where: { id: contactNote.contactId } });
      await db.contactNote.delete({ where: { id } });
      await db.timelineEntry.create({
        data: {
          companyId: contact?.companyId ?? null,
          contactId: contactNote.contactId,
          action: "note_deleted",
          details: "A note was deleted",
        },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  } catch (error) {
    console.error("Failed to delete note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}