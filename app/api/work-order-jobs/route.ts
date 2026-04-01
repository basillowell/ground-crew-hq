import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workOrderId = searchParams.get("work_order_id");
    if (!workOrderId) return badRequest("work_order_id is required");
    const jobs = await query(
      "SELECT * FROM work_order_jobs WHERE work_order_id=$1 ORDER BY position",
      [workOrderId]
    );
    return NextResponse.json(jobs);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { work_order_id, description, position } = await req.json();
    if (!work_order_id) return badRequest("work_order_id is required");
    if (!description?.trim()) return badRequest("description is required");
    const [job] = await query(
      "INSERT INTO work_order_jobs (work_order_id, description, position) VALUES ($1,$2,$3) RETURNING *",
      [work_order_id, description.trim(), position ?? 0]
    );
    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}
