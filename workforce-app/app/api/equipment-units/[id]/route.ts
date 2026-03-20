import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { EquipmentUnit } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { unit_name, status, equipment_type_id } = await req.json();
    const [unit] = await query<EquipmentUnit>(
      `UPDATE equipment_units SET
         unit_name         = COALESCE($1, unit_name),
         status            = COALESCE($2, status),
         equipment_type_id = COALESCE($3, equipment_type_id)
       WHERE id=$4 RETURNING *`,
      [unit_name ?? null, status ?? null, equipment_type_id ?? null, params.id]
    );
    if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(unit);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update unit" }, { status: 500 });
  }
}
