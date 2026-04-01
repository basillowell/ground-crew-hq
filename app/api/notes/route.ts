import { NextRequest } from "next/server";
import { badRequest, ok, serverError } from "@/lib/api";
import { query } from "@/lib/db";
import { Note } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (date) {
      const rows = await query<Note>(
        "SELECT id, date::text AS date, type, content FROM notes WHERE date = $1 ORDER BY type NULLS LAST, id DESC",
        [date]
      );
      return ok(rows);
    }

    if (start) {
      const rows = await query<Note>(
        "SELECT id, date::text AS date, type, content FROM notes WHERE date BETWEEN $1 AND $2 ORDER BY date DESC, type NULLS LAST, id DESC",
        [start, end ?? start]
      );
      return ok(rows);
    }

    return badRequest("date or start/end params required");
  } catch (err) {
    return serverError(err, "GET /notes");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { date, type, content } = await req.json();
    if (!date || !content?.trim()) return badRequest("date and content are required");

    const [note] = await query<Note>(
      `INSERT INTO notes (date, type, content)
       VALUES ($1, $2, $3)
       RETURNING id, date::text AS date, type, content`,
      [date, type?.trim() ?? null, content.trim()]
    );

    return ok(note, 201);
  } catch (err) {
    return serverError(err, "POST /notes");
  }
}
