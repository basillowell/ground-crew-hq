import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { completed, description } = await req.json();
    const [job] = await query(
      `UPDATE work_order_jobs SET
         completed   = COALESCE($1, completed),
         description = COALESCE($2, description)
       WHERE id=$3 RETURNING *`,
      [completed ?? null, description ?? null, params.id]
    );
    return NextResponse.json(job);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await query("DELETE FROM work_order_jobs WHERE id=$1", [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}
