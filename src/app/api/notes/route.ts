import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type"); // "company" or "contact"

    if (!id) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 });
    }
    if (type !== "company" && type !== "contact") {
      return NextResponse.json({ error: "type must be 'company' or 'contact'" }, { status: 400 });
    }

    if (type === "company") {
      const note = await db.companyNote.findUnique({ where: { id } });
      if (!note) {
        return NextResponse.json({ error: "Note not found" }, { status: 404 });
      }
      await db.companyNote.delete({ where: { id } });
      await db.timelineEntry.create({
        data: {
          companyId: note.companyId,
          action: "note_deleted",
          details: "A note was deleted",
        },
      });
    } else {
      const note = await db.contactNote.findUnique({ where: { id } });
      if (!note) {
        return NextResponse.json({ error: "Note not found" }, { status: 404 });
      }
      await db.contactNote.delete({ where: { id } });
      await db.timelineEntry.create({
        data: {
          contactId: note.contactId,
          action: "note_deleted",
          details: "A note was deleted",
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}

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
      });

      await db.timelineEntry.create({
        data: {
          companyId,
          action: "note_added",
          details: `New note added to "${company.name}"`,
        },
      });
    } else if (contactId) {
      const contact = await db.contact.findUnique({ where: { id: contactId } });
      if (!contact) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }

      note = await db.contactNote.create({
        data: {
          contactId,
          body: noteBody.trim(),
          noteType: noteType?.trim() || null,
        },
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

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Failed to create note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}