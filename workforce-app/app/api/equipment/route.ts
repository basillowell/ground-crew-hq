import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { EquipmentUnit } from "@/lib/types";

export async function GET() {
  try {
    const units = await query<EquipmentUnit>(`
      SELECT eu.*, et.name AS type_name, et.short_name
      FROM equipment_units eu
      LEFT JOIN equipment_types et ON et.id = eu.equipment_type_id
      ORDER BY et.name NULLS LAST, eu.unit_name
    `);
    return NextResponse.json(units);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch equipment" }, { status: 500 });
  }
}
