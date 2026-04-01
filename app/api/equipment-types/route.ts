import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest } from "@/lib/api";
import { EquipmentType } from "@/lib/types";

export async function GET() {
  try {
    const rows = await query<EquipmentType>("SELECT * FROM equipment_types ORDER BY name");
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch equipment types" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, short_name } = await req.json();
    if (!name?.trim()) return badRequest("name is required");
    const [row] = await query<EquipmentType>(
      `INSERT INTO equipment_types (name, short_name)
       VALUES ($1, $2)
       RETURNING *`,
      [name.trim(), short_name?.trim() || null]
    );
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create equipment type" }, { status: 500 });
  }
}
