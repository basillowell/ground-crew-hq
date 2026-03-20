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
      task_group: string; task_name: string; total_hours: number; occurrences: number;
    }>(
      `SELECT
         COALESCE(tg.name, 'Ungrouped')  AS task_group,
         t.name                          AS task_name,
         SUM(ta.duration)::float         AS total_hours,
         COUNT(*)::int                   AS occurrences
       FROM task_assignments ta
       JOIN tasks t ON t.id=ta.task_id
       LEFT JOIN task_groups tg ON tg.id=t.group_id
       JOIN shifts s ON s.id=ta.shift_id
       WHERE s.date BETWEEN $1 AND $2
       GROUP BY tg.name, t.name
       ORDER BY tg.name NULLS LAST, total_hours DESC`,
      [start, end]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to run report" }, { status: 500 });
  }
}
