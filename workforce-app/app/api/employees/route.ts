import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest, serverError } from "@/lib/api";
import { Employee } from "@/lib/types";

export async function GET() {
  try {
    const rows = await query<Employee>(`
      SELECT e.*, g.name AS group_name
      FROM employees e
      LEFT JOIN groups g ON g.id = e.group_id
      ORDER BY e.last_name, e.first_name
    `);
    return NextResponse.json(rows);
  } catch (err) {
    return serverError(err, "GET /employees");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { first_name, last_name, photo_url, group_id, worker_type, hourly_rate } = body;
    if (!first_name?.trim() || !last_name?.trim())
      return badRequest("first_name and last_name are required");

    const [emp] = await query<Employee>(
      `INSERT INTO employees (first_name, last_name, photo_url, group_id, worker_type, hourly_rate)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [first_name.trim(), last_name.trim(), photo_url ?? null,
       group_id ?? null, worker_type?.trim() ?? null, hourly_rate ?? 0]
    );
    return NextResponse.json(emp, { status: 201 });
  } catch (err) {
    return serverError(err, "POST /employees");
  }
}
