import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { notFound, serverError } from "@/lib/api";
import { Employee } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { first_name, last_name, photo_url, group_id, worker_type, hourly_rate, active } = body;
    const [emp] = await query<Employee>(
      `UPDATE employees SET
         first_name  = COALESCE($1, first_name),
         last_name   = COALESCE($2, last_name),
         photo_url   = COALESCE($3, photo_url),
         group_id    = CASE WHEN $4::boolean THEN $5::int ELSE group_id END,
         worker_type = COALESCE($6, worker_type),
         hourly_rate = COALESCE($7, hourly_rate),
         active      = COALESCE($8, active)
       WHERE id = $9 RETURNING *`,
      [
        first_name ?? null, last_name ?? null, photo_url ?? null,
        group_id !== undefined, group_id ?? null,
        worker_type ?? null, hourly_rate ?? null, active ?? null,
        params.id,
      ]
    );
    if (!emp) return notFound("Employee");
    return NextResponse.json(emp);
  } catch (err) {
    return serverError(err, `PATCH /employees/${params.id}`);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await query("UPDATE employees SET active = false WHERE id = $1", [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, `DELETE /employees/${params.id}`);
  }
}
