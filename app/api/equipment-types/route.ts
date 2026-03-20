import { NextResponse } from "next/server";
import { query } from "@/lib/db";
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
