import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest } from "@/lib/api";
import { EquipmentUnit } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { equipment_type_id, unit_name, status } = await req.json();
    if (!unit_name?.trim()) return badRequest("unit_name is required");
    const [unit] = await query<EquipmentUnit>(
      `INSERT INTO equipment_units (equipment_type_id, unit_name, status)
       VALUES ($1,$2,$3) RETURNING *`,
      [equipment_type_id ?? null, unit_name.trim(), status ?? "ready"]
    );
    return NextResponse.json(unit, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create unit" }, { status: 500 });
  }
}
