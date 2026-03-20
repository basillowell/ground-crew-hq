import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end   = searchParams.get("end");
    if (!start || !end) return badRequest("start and end query params required");

    const rows = await query<{
      employee_id: number; full_name: string; hourly_rate: number;
      total_hours: number; total_cost: number;
    }>(
      `SELECT
         e.id                                                    AS employee_id,
         e.first_name || ' ' || e.last_name                     AS full_name,
         e.hourly_rate,
         COALESCE(SUM(ta.duration), 0)::float                   AS total_hours,
         COALESCE(SUM(ta.duration * e.hourly_rate), 0)::float   AS total_cost
       FROM employees e
       LEFT JOIN shifts s ON s.employee_id=e.id AND s.date BETWEEN $1 AND $2 AND s.is_day_off=false
       LEFT JOIN task_assignments ta ON ta.shift_id=s.id
       WHERE e.active=true
       GROUP BY e.id, e.first_name, e.last_name, e.hourly_rate
       ORDER BY total_cost DESC`,
      [start, end]
    );

    const totals = rows.reduce(
      (acc, r) => ({ total_hours: acc.total_hours + r.total_hours, total_cost: acc.total_cost + r.total_cost }),
      { total_hours: 0, total_cost: 0 }
    );

    return NextResponse.json({ rows, totals, start, end });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to run report" }, { status: 500 });
  }
}
