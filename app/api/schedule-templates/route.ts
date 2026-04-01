import { NextRequest } from "next/server";
import { badRequest, ok, serverError } from "@/lib/api";
import { query } from "@/lib/db";
import { ScheduleTemplate } from "@/lib/types";

async function ensureTemplatesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schedule_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      week_data JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET() {
  try {
    await ensureTemplatesTable();
    const rows = await query<ScheduleTemplate>(
      "SELECT id, name, week_data FROM schedule_templates ORDER BY name"
    );
    return ok(rows);
  } catch (err) {
    return serverError(err, "GET /schedule-templates");
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTemplatesTable();
    const { name, week_data } = await req.json();
    if (!name?.trim()) return badRequest("name is required");
    if (!Array.isArray(week_data)) return badRequest("week_data array is required");

    const [template] = await query<ScheduleTemplate>(
      `INSERT INTO schedule_templates (name, week_data)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (name) DO UPDATE SET week_data = EXCLUDED.week_data
       RETURNING id, name, week_data`,
      [name.trim(), JSON.stringify(week_data)]
    );

    return ok(template, 201);
  } catch (err) {
    return serverError(err, "POST /schedule-templates");
  }
}
