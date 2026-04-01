import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { EquipmentType } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, short_name } = await req.json();
    const [row] = await query<EquipmentType>(
      `UPDATE equipment_types
       SET name = COALESCE($1, name),
           short_name = $2
       WHERE id = $3
       RETURNING *`,
      [name?.trim() || null, short_name?.trim() || null, params.id]
    );
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update equipment type" }, { status: 500 });
  }
}
