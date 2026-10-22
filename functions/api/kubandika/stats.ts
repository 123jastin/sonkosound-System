// functions/api/kubandika/stats.ts
// GET /api/kubandika/stats — aggregated totals (IN / OUT / balance) for both regions

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
      // ---- Today ----
      const todayIn: any = await env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM kubandika_payments
         WHERE region = ? AND date = ? AND (type = 'IN' OR type IS NULL)`
      ).bind(region, today).first();

      const todayOut: any = await env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM kubandika_payments
         WHERE region = ? AND date = ? AND type = 'OUT'`
      ).bind(region, today).first();

      // ---- This Month ----
      const monthIn: any = await env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM kubandika_payments
         WHERE region = ? AND date >= ? AND (type = 'IN' OR type IS NULL)`
      ).bind(region, monthStartStr).first();

      const monthOut: any = await env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM kubandika_payments
         WHERE region = ? AND date >= ? AND type = 'OUT'`
      ).bind(region, monthStartStr).first();

      // ---- All Time ----
      const allIn: any = await env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM kubandika_payments
         WHERE region = ? AND (type = 'IN' OR type IS NULL)`
      ).bind(region).first();

      const allOut: any = await env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM kubandika_payments
         WHERE region = ? AND type = 'OUT'`
      ).bind(region).first();

      const tIn = todayIn?.total || 0;
      const tOut = todayOut?.total || 0;
      const mIn = monthIn?.total || 0;
      const mOut = monthOut?.total || 0;
      const aIn = allIn?.total || 0;
      const aOut = allOut?.total || 0;

      result[region] = {
        today: {
          in: tIn,
          out: tOut,
          balance: tIn - tOut,
          count: (todayIn?.count || 0) + (todayOut?.count || 0),
        },
        month: {
          in: mIn,
          out: mOut,
          balance: mIn - mOut,
          count: (monthIn?.count || 0) + (monthOut?.count || 0),
        },
        allTime: {
          in: aIn,
          out: aOut,
          balance: aIn - aOut,
          count: (allIn?.count || 0) + (allOut?.count || 0),
        },
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
