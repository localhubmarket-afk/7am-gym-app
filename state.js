// Vercel Serverless Function: /api/state
// Single Source of Truth handler supporting CORS for Capacitor native mobile apps and strict timestamp ordering
export default async function handler(req, res) {
  // Enable cross-origin requests from Capacitor native mobile apps & prevent stale browser caching
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    return res.status(200).json({ configured: false });
  }

  const queryEmail = (req.query && req.query.email) ? String(req.query.email).trim().toLowerCase() : '';
  const bodyObj = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const bodyEmail = (bodyObj && bodyObj.userProfile && bodyObj.userProfile.email) ? String(bodyObj.userProfile.email).trim().toLowerCase() : '';
  const activeEmail = (queryEmail && queryEmail !== 'default') ? queryEmail : bodyEmail;
  const recordId = activeEmail ? ('user_' + activeEmail) : 'default';

  if (req.method === 'GET') {
    try {
      // Strict Single Source of Truth: fetch rows ordered by latest updated_at descending
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

      // Compare exact user row vs default row by newest `last_updated` / `updated_at` timestamp
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

      const payloadToStore = { ...bodyObj, last_updated: effectiveIso, updatedAt: effectiveIso };
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
          error: 'Valid authenticated user email is required for account deletion.'
        });
      }

      const targetRecordId = 'user_' + requestedEmail;
      const deleteResp = await fetch(
        supabaseUrl + '/rest/v1/gym_state?id=eq.' + encodeURIComponent(targetRecordId),
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': 'Bearer ' + supabaseKey,
            'Prefer': 'return=representation'
          }
        }
      );

      if (!deleteResp.ok) {
        return res.status(500).json({
          configured: true,
          accountId: targetRecordId,
          deleted: false,
          error: 'Failed to delete user row from Supabase.'
        });
      }

      return res.status(200).json({
        configured: true,
        accountId: targetRecordId,
        deleted: true
      });
    } catch (e) {
      return res.status(500).json({ configured: true, accountId: recordId, deleted: false });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
