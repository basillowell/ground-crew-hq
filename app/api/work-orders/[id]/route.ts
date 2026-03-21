import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { title, description, status, priority, service_hours, estimated_hours, actual_hours, due_date } = body;
    const completedAt = status === "completed" ? new Date().toISOString() : null;

    const [wo] = await query(
      `UPDATE work_orders_v2 SET
         title           = COALESCE($1, title),
         description     = COALESCE($2, description),
         status          = COALESCE($3, status),
         priority        = COALESCE($4, priority),
         service_hours   = COALESCE($5, service_hours),
         estimated_hours = COALESCE($6, estimated_hours),
         actual_hours    = COALESCE($7, actual_hours),
         due_date        = COALESCE($8, due_date),
         completed_at    = CASE WHEN $3 = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $9 RETURNING *`,
      [title ?? null, description ?? null, status ?? null, priority ?? null,
       service_hours ?? null, estimated_hours ?? null, actual_hours ?? null,
       due_date ?? null, params.id]
    );
    if (!wo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(wo);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update work order" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await query("DELETE FROM work_orders_v2 WHERE id = $1", [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete work order" }, { status: 500 });
  }
}
