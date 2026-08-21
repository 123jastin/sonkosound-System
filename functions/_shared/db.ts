import { createClient } from '@libsql/client';
// OR use better-sqlite3 if that's what you're using

// Check how your existing db is set up and use the same
const db = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
  authToken: process.env.DATABASE_AUTH_TOKEN
});

export async function query(sql: string, params: any[] = []) {
  const result = await db.execute({
    sql,
    args: params
  });
  return result.rows;
}
