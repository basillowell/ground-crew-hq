import { Pool, QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,                    // ← lowered from 10
    idleTimeoutMillis: 10_000, // ← release idle connections faster
    connectionTimeoutMillis: 5_000,
  });
}

const pool: Pool = global._pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") global._pgPool = pool;

export default pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query<T>(text, params);
    return res.rows;
  } finally {
    client.release();
  }
}
```

Then also go to **Supabase → Connect → Transaction pooler** and switch your `DATABASE_URL` in Vercel to the **Transaction pooler** URL instead of Session pooler. Transaction pooler handles many connections far better for serverless apps.

The Transaction pooler URL looks like:
```
postgresql://postgres.gznslxgixbtkuwhbczje:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres