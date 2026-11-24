// Server-side Supabase Biometrics API: /api/biometrics
// Stores and retrieves Apple HealthKit & Google Health Connect recovery metrics
// (sleep_hours, daily_steps, resting_heart_rate) for the deterministic progression engine.

const ALLOWED_PROVIDERS = new Set([
  'apple_healthkit',
  'google_health_connect',
  'manual_override'
]);

function clampNumber(val, min, max) {
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  return Math.max(min, Math.min(max, num));
}

function sanitizeDateIso(raw) {
  const str = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const requestOrigin = req?.headers?.origin ? String(req.headers.origin) : '';
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const authHeader = typeof req?.headers?.authorization === 'string' ? req.headers.authorization.trim() : '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json({
      ok: false,
      configured: false,
      saved: false,
      biometrics: null,
      note: 'Supabase is not configured on this server. Biometrics remain saved on this device.'
    });
  }

  const restHeaders = {
    apikey: supabaseKey,
    Authorization: 'Bearer ' + (bearerToken || supabaseKey),
    'Content-Type': 'application/json'
  };

  if (req.method === 'GET') {
    try {
      const rawUserId = String(req?.query?.userId || req?.query?.email || '').trim().toLowerCase();
      if (!rawUserId || rawUserId.length > 160) {
        return res.status(400).json({ ok: false, error: 'Valid userId or email query parameter is required.' });
      }
      const queryUrl =
        `${supabaseUrl}/rest/v1/daily_biometrics?account_key=eq.${encodeURIComponent(rawUserId)}` +
        '&order=recorded_date.desc,synced_at.desc&limit=1';

      const resp = await fetch(queryUrl, { headers: restHeaders });
      if (!resp.ok) {
        return res.status(200).json({ ok: false, configured: true, biometrics: null });
      }
      const rows = await resp.json().catch(() => []);
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      return res.status(200).json({
        ok: true,
        configured: true,
        biometrics: row
          ? {
              provider: row.provider,
              dateIso: row.recorded_date,
              sleepHours: Number(row.sleep_hours),
              dailySteps: Number(row.daily_steps),
              restingHeartRateBpm: row.resting_heart_rate != null ? Number(row.resting_heart_rate) : null,
              syncedAt: row.synced_at,
              isStub: false
            }
          : null
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        configured: true,
        error: err instanceof Error ? err.message : 'Failed to load biometrics.'
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const accountKey = String(body.accountKey || body.userId || body.email || '').trim().toLowerCase();
      if (!accountKey || accountKey.length > 160) {
        return res.status(400).json({ ok: false, error: 'accountKey (userId or email) is required.' });
      }

      const provider = ALLOWED_PROVIDERS.has(String(body.provider))
        ? String(body.provider)
        : 'manual_override';
      const sleepHours = clampNumber(body.sleepHours ?? body.sleep_hours, 0, 24);
      const dailySteps = clampNumber(body.dailySteps ?? body.daily_steps, 0, 200000);
      const restingHeartRate =
        body.restingHeartRateBpm != null || body.resting_heart_rate != null
          ? clampNumber(body.restingHeartRateBpm ?? body.resting_heart_rate, 25, 220)
          : null;

      if (sleepHours === null || dailySteps === null) {
        return res.status(400).json({
          ok: false,
          error: 'Numeric sleepHours (0-24) and dailySteps (0-200000) are required.'
        });
      }

      const recordedDate = sanitizeDateIso(body.dateIso ?? body.recorded_date);
      const nowIso = new Date().toISOString();
      const rowPayload = {
        account_key: accountKey,
        user_id: typeof body.authUserId === 'string' && /^[0-9a-f-]{36}$/i.test(body.authUserId)
          ? body.authUserId
          : null,
        provider,
        recorded_date: recordedDate,
        sleep_hours: Math.round(sleepHours * 100) / 100,
        daily_steps: Math.round(dailySteps),
        resting_heart_rate: restingHeartRate !== null ? Math.round(restingHeartRate) : null,
        synced_at: nowIso
      };

      const upsertResp = await fetch(
        `${supabaseUrl}/rest/v1/daily_biometrics?on_conflict=account_key,recorded_date`,
        {
          method: 'POST',
          headers: {
            ...restHeaders,
            Prefer: 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(rowPayload)
        }
      );

      if (!upsertResp.ok) {
        const detail = await upsertResp.text().catch(() => '');
        return res.status(502).json({
          ok: false,
          configured: true,
          saved: false,
          error: detail || 'Supabase rejected the biometric record.'
        });
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        saved: true,
        biometrics: {
          provider,
          dateIso: recordedDate,
          sleepHours: rowPayload.sleep_hours,
          dailySteps: rowPayload.daily_steps,
          restingHeartRateBpm: rowPayload.resting_heart_rate,
          syncedAt: nowIso,
          isStub: false
        }
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        configured: true,
        saved: false,
        error: err instanceof Error ? err.message : 'Unexpected biometrics sync error.'
      });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
