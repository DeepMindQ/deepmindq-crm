import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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