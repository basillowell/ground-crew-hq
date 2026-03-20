import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest } from "@/lib/api";
import { Task } from "@/lib/types";

export async function GET() {
  try {
    const tasks = await query<Task>(`
      SELECT t.*, tg.name AS group_name
      FROM tasks t
      LEFT JOIN task_groups tg ON tg.id = t.group_id
      ORDER BY tg.name NULLS LAST, t.name
    `);
    return NextResponse.json(tasks);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, group_id } = await req.json();
    if (!name?.trim()) return badRequest("name is required");
    const [task] = await query<Task>(
      "INSERT INTO tasks (name, group_id) VALUES ($1,$2) RETURNING *",
      [name.trim(), group_id ?? null]
    );
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
