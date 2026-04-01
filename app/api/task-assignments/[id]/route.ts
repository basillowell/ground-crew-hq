import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { TaskAssignment } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { shift_id, task_id, duration, position, equipment_unit_id } = await req.json();
    const [row] = await query<TaskAssignment>(
      `UPDATE task_assignments SET
         shift_id          = COALESCE($1, shift_id),
         task_id           = COALESCE($2, task_id),
         duration          = COALESCE($3, duration),
         position          = COALESCE($4, position),
         equipment_unit_id = CASE WHEN $5::boolean THEN $6 ELSE equipment_unit_id END
       WHERE id=$7 RETURNING *`,
      [
        shift_id ?? null,
        task_id ?? null,
        duration ?? null,
        position ?? null,
        equipment_unit_id !== undefined,
        equipment_unit_id ?? null,
        params.id,
      ]
    );
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await query("DELETE FROM task_assignments WHERE id=$1", [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
  }
}
