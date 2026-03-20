import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest } from "@/lib/api";
import { TaskGroup } from "@/lib/types";

export async function GET() {
  try {
    const rows = await query<TaskGroup>("SELECT * FROM task_groups ORDER BY name");
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch task groups" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) return badRequest("name is required");
    const [row] = await query<TaskGroup>(
      "INSERT INTO task_groups (name) VALUES ($1) RETURNING *",
      [name.trim()]
    );
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create task group" }, { status: 500 });
  }
}
