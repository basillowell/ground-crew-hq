import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest } from "@/lib/api";
import { Group } from "@/lib/types";

export async function GET() {
  try {
    const groups = await query<Group>("SELECT * FROM groups ORDER BY name");
    return NextResponse.json(groups);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) return badRequest("name is required");
    const [group] = await query<Group>(
      "INSERT INTO groups (name) VALUES ($1) RETURNING *",
      [name.trim()]
    );
    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
