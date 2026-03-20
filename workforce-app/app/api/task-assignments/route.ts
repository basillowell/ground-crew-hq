import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest, unprocessable } from "@/lib/api";
import { TaskAssignment } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date    = searchParams.get("date");
    const shiftId = searchParams.get("shift_id");

    const base = `
      SELECT ta.*, t.name AS task_name, eu.unit_name AS equipment_unit_name
      FROM task_assignments ta
      LEFT JOIN tasks t ON t.id = ta.task_id
      LEFT JOIN equipment_units eu ON eu.id = ta.equipment_unit_id
    `;
    let rows: TaskAssignment[];
    if (shiftId) {
      rows = await query<TaskAssignment>(base + " WHERE ta.shift_id=$1 ORDER BY ta.position", [shiftId]);
    } else if (date) {
      rows = await query<TaskAssignment>(
        base + " WHERE ta.shift_id IN (SELECT id FROM shifts WHERE date=$1) ORDER BY ta.shift_id, ta.position",
        [date]
      );
    } else {
      return badRequest("date or shift_id param required");
    }
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shift_id, task_id, duration, position, equipment_unit_id } = body;
    if (!shift_id || !task_id) return badRequest("shift_id and task_id are required");
    if (typeof duration !== "number" || duration <= 0) return badRequest("duration must be a positive number");

    if (equipment_unit_id) {
      const [unit] = await query<{ status: string }>(
        "SELECT status FROM equipment_units WHERE id=$1", [equipment_unit_id]
      );
      if (!unit)                   return unprocessable("Equipment unit not found");
      if (unit.status !== "ready") return unprocessable("Equipment is not available (status must be 'ready')");

      const [conflict] = await query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM task_assignments ta
         JOIN shifts s ON s.id = ta.shift_id
         WHERE ta.equipment_unit_id=$1
           AND s.date = (SELECT date FROM shifts WHERE id=$2)
           AND ta.shift_id != $2`,
        [equipment_unit_id, shift_id]
      );
      if (parseInt(conflict.count) > 0)
        return unprocessable("Equipment is already assigned on this date");
    }

    const [assignment] = await query<TaskAssignment>(
      `INSERT INTO task_assignments (shift_id, task_id, duration, position, equipment_unit_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [shift_id, task_id, duration, position ?? 0, equipment_unit_id ?? null]
    );
    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}
