import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { TaskAssignment } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { task_id, duration, position, equipment_unit_id } = await req.json();
    // Use explicit null to clear equipment_unit_id — don't use COALESCE for nullable clears
    const [row] = await query<TaskAssignment>(
      `UPDATE task_assignments SET
         task_id           = COALESCE($1, task_id),
         duration          = COALESCE($2, duration),
         position          = COALESCE($3, position),
         equipment_unit_id = CASE WHEN $4::boolean THEN $5 ELSE equipment_unit_id END
       WHERE id=$6 RETURNING *`,
      [
        task_id ?? null,
        duration ?? null,
        position ?? null,
        equipment_unit_id !== undefined,  // $4 — was it sent?
        equipment_unit_id ?? null,        // $5 — the value (can be null to clear)
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
