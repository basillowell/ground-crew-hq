import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { Shift } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { start_time, end_time, is_day_off } = await req.json();
    const [shift] = await query<Shift>(
      `UPDATE shifts SET
         start_time = COALESCE($1, start_time),
         end_time   = COALESCE($2, end_time),
         is_day_off = COALESCE($3, is_day_off)
       WHERE id = $4
       RETURNING id, employee_id, date::text AS date, start_time::text AS start_time, end_time::text AS end_time, is_day_off`,
      [start_time ?? null, end_time ?? null, is_day_off ?? null, params.id]
    );
    if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(shift);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update shift" }, { status: 500 });
  }
}
