import { NextRequest } from "next/server";
import { notFound, ok, serverError } from "@/lib/api";
import { query } from "@/lib/db";
import { Note } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { type, content } = await req.json();
    const [note] = await query<Note>(
      `UPDATE notes
       SET type = COALESCE($1, type),
           content = COALESCE($2, content)
       WHERE id = $3
       RETURNING id, date::text AS date, type, content`,
      [type ?? null, content?.trim() ?? null, params.id]
    );

    if (!note) return notFound("Note");
    return ok(note);
  } catch (err) {
    return serverError(err, "PATCH /notes/[id]");
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await query("DELETE FROM notes WHERE id = $1", [params.id]);
    return ok({ ok: true });
  } catch (err) {
    return serverError(err, "DELETE /notes/[id]");
  }
}
