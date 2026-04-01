import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest } from "@/lib/api";
import { Shift } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (!start) return badRequest("start param required");

    const shifts = await query<Shift>(
      `SELECT id, employee_id, date::text AS date, start_time::text AS start_time, end_time::text AS end_time, is_day_off
       FROM shifts
       WHERE date BETWEEN $1 AND $2
       ORDER BY date, employee_id`,
      [start, end ?? start]
    );
    return NextResponse.json(shifts);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employee_id, date, start_time, end_time, is_day_off } = body;
    if (!employee_id || !date) return badRequest("employee_id and date are required");

    const [existing] = await query<Shift>(
      `SELECT id, employee_id, date::text AS date, start_time::text AS start_time, end_time::text AS end_time, is_day_off
       FROM shifts
       WHERE employee_id = $1 AND date = $2
       LIMIT 1`,
      [employee_id, date]
    );

    if (existing) {
      const [updated] = await query<Shift>(
        `UPDATE shifts
         SET start_time = $1,
             end_time = $2,
             is_day_off = $3
         WHERE id = $4
         RETURNING id, employee_id, date::text AS date, start_time::text AS start_time, end_time::text AS end_time, is_day_off`,
        [start_time ?? null, end_time ?? null, is_day_off ?? false, existing.id]
      );
      return NextResponse.json(updated);
    }

    const [shift] = await query<Shift>(
      `INSERT INTO shifts (employee_id, date, start_time, end_time, is_day_off)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, employee_id, date::text AS date, start_time::text AS start_time, end_time::text AS end_time, is_day_off`,
      [employee_id, date, start_time ?? null, end_time ?? null, is_day_off ?? false]
    );

    return NextResponse.json(shift, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save shift" }, { status: 500 });
  }
}
