import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest } from "@/lib/api";

export interface WorkOrder {
  id: number;
  equipment_unit_id: number;
  unit_name?: string;
  type_name?: string;
  title: string;
  description?: string;
  status: "not_started" | "in_progress" | "completed" | "skipped";
  priority: "current" | "upcoming" | "scheduled";
  service_hours?: number;
  estimated_hours?: number;
  actual_hours?: number;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  job_count?: number;
  jobs_done?: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const unitId = searchParams.get("unit_id");
    const status = searchParams.get("status");

    let sql = `
      SELECT wo.*,
             eu.unit_name, et.name AS type_name,
             COUNT(woj.id)::int                              AS job_count,
             COUNT(woj.id) FILTER (WHERE woj.completed)::int AS jobs_done
      FROM work_orders_v2 wo
      LEFT JOIN equipment_units eu ON eu.id = wo.equipment_unit_id
      LEFT JOIN equipment_types et ON et.id = eu.equipment_type_id
      LEFT JOIN work_order_jobs woj ON woj.work_order_id = wo.id
    `;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (unitId) { conditions.push(`wo.equipment_unit_id = $${params.length + 1}`); params.push(unitId); }
    if (status) { conditions.push(`wo.status = $${params.length + 1}`); params.push(status); }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " GROUP BY wo.id, eu.unit_name, et.name ORDER BY wo.created_at DESC";

    const rows = await query<WorkOrder>(sql, params);
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch work orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { equipment_unit_id, title, description, priority, service_hours, estimated_hours, due_date } = body;
    if (!equipment_unit_id) return badRequest("equipment_unit_id is required");
    if (!title?.trim())     return badRequest("title is required");

    const [wo] = await query<WorkOrder>(
      `INSERT INTO work_orders_v2 (equipment_unit_id, title, description, priority, service_hours, estimated_hours, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [equipment_unit_id, title.trim(), description ?? null, priority ?? "scheduled",
       service_hours ?? null, estimated_hours ?? null, due_date ?? null]
    );
    return NextResponse.json(wo, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create work order" }, { status: 500 });
  }
}
