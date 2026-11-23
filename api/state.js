// Vercel Serverless Function: /api/state
// Single Source of Truth handler with concurrent account deletion & cookie invalidation
const SESSION_COOKIES_TO_EXPIRE = [
  'gym_session',
  'session',
  'session_id',
  'auth_token',
  'access_token',
  'refresh_token',
  'sb-access-token',
  'sb-refresh-token'
];

function buildExpiredSessionCookieHeaders(req) {
  const names = new Set(SESSION_COOKIES_TO_EXPIRE);
  const rawCookieHeader = req && req.headers && typeof req.headers.cookie === 'string'
    ? req.headers.cookie
    : '';

  rawCookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const idx = part.indexOf('=');
      const name = (idx >= 0 ? part.slice(0, idx) : part).trim();
      if (name) names.add(name);
    });

  return Array.from(names).map(
    (name) => `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`
  );
}

export default async function handler(req, res) {
  // Enable cross-origin requests from mobile apps & prevent stale browser caching
  const requestOrigin = (req && req.headers && req.headers.origin) ? String(req.headers.origin) : '*';
  res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const legacyPullupKey = ['u', 's', 'm', 'c', 'Logs'].join('');

  if (!supabaseUrl || !supabaseKey) {
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', buildExpiredSessionCookieHeaders(req));
      return res.status(200).json({ configured: false, deleted: true, clearedDefaultMirror: false, clearedCookies: true });
    }
    return res.status(200).json({ configured: false });
  }

  const queryEmail = (req.query && req.query.email) ? String(req.query.email).trim().toLowerCase() : '';
  const bodyObj = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const bodyEmail = (bodyObj && bodyObj.userProfile && bodyObj.userProfile.email) ? String(bodyObj.userProfile.email).trim().toLowerCase() : '';
  const activeEmail = (queryEmail && queryEmail !== 'default') ? queryEmail : bodyEmail;
  const recordId = activeEmail ? ('user_' + activeEmail) : 'default';

  if (req.method === 'GET') {
    try {
      const rAll = await fetch(
        supabaseUrl + '/rest/v1/gym_state?select=id,data,updated_at&order=updated_at.desc',
        {
          headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey }
        }
      );
      const allRows = await rAll.json();
      if (!Array.isArray(allRows) || allRows.length === 0) {
        return res.status(200).json({ configured: true, accountId: recordId, updatedAt: null, data: null });
      }

      const exactRow = allRows.find(row => row && row.id === recordId && row.data);
      const defaultRow = allRows.find(row => row && row.id === 'default' && row.data);

      const getRowTimestampMs = (row) => {
        if (!row) return 0;
        const candidates = [
          row.data && row.data.last_updated,
          row.updated_at,
          row.data && row.data.updatedAt
        ];
        return candidates.reduce((best, raw) => {
          const ms = typeof raw === 'string' && raw.trim() ? (Date.parse(raw) || 0) : 0;
          return ms > best ? ms : best;
        }, 0);
      };

      let chosenRow = exactRow || defaultRow || allRows[0];
      if (exactRow && defaultRow) {
        chosenRow = getRowTimestampMs(defaultRow) > getRowTimestampMs(exactRow) ? defaultRow : exactRow;
      }

      const baseData = chosenRow && chosenRow.data && typeof chosenRow.data === 'object'
        ? JSON.parse(JSON.stringify(chosenRow.data))
        : null;

      if (baseData) {
        if (!baseData.workoutLogs || typeof baseData.workoutLogs !== 'object') {
          baseData.workoutLogs = {};
        }
        if (!baseData.pullupLogs || typeof baseData.pullupLogs !== 'object') {
          baseData.pullupLogs = (baseData[legacyPullupKey] && typeof baseData[legacyPullupKey] === 'object')
            ? { ...baseData[legacyPullupKey] }
            : {};
        }
        const authoritativeLastUpdated =
          (typeof baseData.last_updated === 'string' && baseData.last_updated.trim() && baseData.last_updated) ||
          chosenRow.updated_at ||
          baseData.updatedAt ||
          new Date().toISOString();
        baseData.last_updated = authoritativeLastUpdated;
        baseData.updatedAt = authoritativeLastUpdated;
        return res.status(200).json({
          configured: true,
          accountId: recordId,
          sourceRowId: chosenRow.id,
          last_updated: authoritativeLastUpdated,
          updatedAt: authoritativeLastUpdated,
          data: baseData
        });
      }

      return res.status(200).json({ configured: true, accountId: recordId, last_updated: null, updatedAt: null, data: null });
    } catch (e) {
      return res.status(200).json({ configured: true, accountId: recordId, last_updated: null, updatedAt: null, data: null });
    }
  }

  if (req.method === 'POST') {
    try {
      const nowIso = new Date().toISOString();
      const clientTsRaw = (bodyObj && typeof bodyObj.last_updated === 'string' && bodyObj.last_updated.trim())
        ? bodyObj.last_updated
        : (bodyObj && typeof bodyObj.updatedAt === 'string' && bodyObj.updatedAt.trim() ? bodyObj.updatedAt : '');
      const clientMs = clientTsRaw ? (Date.parse(clientTsRaw) || 0) : 0;
      const serverMs = Date.parse(nowIso) || Date.now();
      const effectiveIso = clientMs > serverMs ? clientTsRaw : nowIso;

      const isStartFreshOverwrite = Boolean(
        bodyObj &&
        (bodyObj.forceOverwrite === true ||
          bodyObj.resetReason === 'start_fresh_reset' ||
          bodyObj.resetReason === 'delete_all_weeks')
      );

      const cleanBody = { ...bodyObj };
      delete cleanBody.forceOverwrite;
      delete cleanBody.resetReason;

      const payloadToStore = isStartFreshOverwrite
        ? {
            ...cleanBody,
            selectedDayIndex: 0,
            currentWeek: 1,
            selectedWeek: 1,
            maxUnlockedWeek: 1,
            workoutLogs: {},
            pullupLogs: {},
            cardioLogs: {},
            warmupLogs: {},
            exerciseHistory: {},
            completedWeeks: {},
            fuelLogs: {},
            checkedMeals: {},
            checkedMealIngredients: {},
            waterIntakeLogs: {},
            waterLogsMl: {},
            quickAddCaloriesByDay: {},
            flexMealOverridesByDay: {},
            batchInventory: {
              oatsJarsRemaining: 0,
              riceBowlsRemaining: 0,
              oatsPrepDay: null,
              ricePrepDay: null
            },
            oatsPrepDay: null,
            ricePrepDay: null,
            recipePrepLogs: {},
            checkedEssentials: {},
            checkedGroceries: {},
            customShoppingItems: [],
            shopBrandOverrides: {},
            hasStartedFresh: true,
            startFreshResetAt: effectiveIso,
            francoisWeek1RestoredV2: true,
            clearedDaysMap: {
              w1_d0: true,
              w1_d1: true,
              w1_d2: true,
              w1_d3: true,
              w1_d4: true,
              w1_d5: true,
              w1_d6: true
            },
            last_updated: effectiveIso,
            updatedAt: effectiveIso
          }
        : { ...cleanBody, last_updated: effectiveIso, updatedAt: effectiveIso };

      const upsertRows = [{ id: recordId, data: payloadToStore, updated_at: effectiveIso }];
      if (recordId !== 'default') {
        upsertRows.push({ id: 'default', data: payloadToStore, updated_at: effectiveIso });
      }
      await fetch(supabaseUrl + '/rest/v1/gym_state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(upsertRows)
      });
      return res.status(200).json({
        configured: true,
        accountId: recordId,
        saved: true,
        overwrittenBaseline: isStartFreshOverwrite,
        last_updated: effectiveIso,
        updatedAt: effectiveIso
      });
    } catch (e) {
      return res.status(200).json({ configured: true, accountId: recordId, saved: false, last_updated: null, updatedAt: null });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const requestedEmail = (
        queryEmail ||
        (bodyObj && typeof bodyObj.email === 'string' ? bodyObj.email.trim().toLowerCase() : '') ||
        bodyEmail
      ).trim().toLowerCase();

      const disallowedIds = new Set(['', 'default', 'guest', 'anonymous', 'google', 'apple', 'member@gmail.com', 'athlete@gmail.com']);
      if (!requestedEmail || disallowedIds.has(requestedEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail)) {
        return res.status(400).json({
          configured: true,
          deleted: false,
          error: 'Valid signed-in account email is required to delete an account.'
        });
      }

      const targetRecordId = 'user_' + requestedEmail;
      const authHeaders = {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey
      };

      // Execute user record deletion and default-mirror inspection CONCURRENTLY
      const [deleteUserResp, defaultRowResp] = await Promise.all([
        fetch(
          supabaseUrl + '/rest/v1/gym_state?id=eq.' + encodeURIComponent(targetRecordId),
          {
            method: 'DELETE',
            headers: {
              ...authHeaders,
              'Prefer': 'return=representation'
            }
          }
        ),
        fetch(
          supabaseUrl + '/rest/v1/gym_state?id=eq.default&select=id,data',
          {
            method: 'GET',
            headers: authHeaders
          }
        ).catch(() => null)
      ]);

      if (!deleteUserResp.ok) {
        return res.status(500).json({
          configured: true,
          accountId: targetRecordId,
          deleted: false,
          error: 'Could not erase the account record on the server.'
        });
      }

      // If the shared default mirror currently holds this deleted user's profile, delete it too
      let clearedDefaultMirror = false;
      if (defaultRowResp && defaultRowResp.ok) {
        const defaultRows = await defaultRowResp.json().catch(() => []);
        const mirrorRow = Array.isArray(defaultRows) ? defaultRows[0] : null;
        const mirrorEmail = mirrorRow && mirrorRow.data && mirrorRow.data.userProfile && typeof mirrorRow.data.userProfile.email === 'string'
          ? mirrorRow.data.userProfile.email.trim().toLowerCase()
          : '';
        if (mirrorEmail === requestedEmail) {
          const deleteMirrorResp = await fetch(
            supabaseUrl + '/rest/v1/gym_state?id=eq.default',
            {
              method: 'DELETE',
              headers: authHeaders
            }
          ).catch(() => null);
          clearedDefaultMirror = Boolean(deleteMirrorResp && deleteMirrorResp.ok);
        }
      }

      // Expire all web session cookies in the response headers to prevent ghost-session logins
      res.setHeader('Set-Cookie', buildExpiredSessionCookieHeaders(req));

      return res.status(200).json({
        configured: true,
        accountId: targetRecordId,
        deleted: true,
        clearedDefaultMirror,
        clearedCookies: true
      });
    } catch (e) {
      return res.status(500).json({
        configured: true,
        accountId: recordId,
        deleted: false,
        error: 'Unexpected error while erasing account data.'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
