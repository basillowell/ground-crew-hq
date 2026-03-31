import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest, serverError } from "@/lib/api";
import { Note } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    let rows: Note[];
    if (date) {
      rows = await query<Note>(
        "SELECT id, date::text, type, content FROM notes WHERE date=$1 ORDER BY created_at DESC, id DESC",
        [date]
      );
    } else if (start) {
      rows = await query<Note>(
        "SELECT id, date::text, type, content FROM notes WHERE date BETWEEN $1 AND $2 ORDER BY date ASC, created_at DESC, id DESC",
        [start, end ?? start]
      );
    } else {
      return badRequest("date or start param required");
    }

    return NextResponse.json(rows);
  } catch (err) {
    return serverError(err, "GET /notes");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, type, content } = body;

    if (!date) return badRequest("date is required");
    if (!content?.trim()) return badRequest("content is required");

    const [note] = await query<Note>(
      `INSERT INTO notes (date, type, content)
       VALUES ($1, $2, $3)
       RETURNING id, date::text, type, content`,
      [date, type?.trim() ?? null, content.trim()]
    );

    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    return serverError(err, "POST /notes");
  }
}
