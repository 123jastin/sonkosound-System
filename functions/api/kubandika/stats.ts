// functions/api/kubandika/stats.ts
// GET /api/kubandika/stats  — aggregated totals for both regions

interface Env {
  DB: D1Database;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const result: Record<string, any> = {};

    for (const region of ['Tz', 'China']) {
      const todayRow: any = await env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count 
         FROM kubandika_payments WHERE region = ? AND date = ?`
      ).bind(region, today).first();

      const monthRow: any = await env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count 
         FROM kubandika_payments WHERE region = ? AND date >= ?`
      ).bind(region, monthStartStr).first();

      const allRow: any = await env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count 
         FROM kubandika_payments WHERE region = ?`
      ).bind(region).first();

      result[region] = {
        today: { total: todayRow?.total || 0, count: todayRow?.count || 0 },
        month: { total: monthRow?.total || 0, count: monthRow?.count || 0 },
        allTime: { total: allRow?.total || 0, count: allRow?.count || 0 },
      };
    }

    return jsonResponse(result);
  } catch (error: any) {
    console.error('❌ Failed to load kubandika stats:', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Imeshindwa kupata takwimu' },
      500
    );
  }
};
