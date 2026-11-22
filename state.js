// Vercel Serverless Function: /api/state
// Single Source of Truth handler supporting CORS for Capacitor native mobile apps and strict timestamp ordering
export default async function handler(req, res) {
  // Enable cross-origin requests from Capacitor native mobile apps & prevent stale browser caching
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

      // Compare exact user row vs default row by updated_at so computer & phone always read the newest timestamped state
      let chosenRow = exactRow || defaultRow || allRows[0];
      if (exactRow && defaultRow) {
        const exactTs = Date.parse(exactRow.updated_at || (exactRow.data && exactRow.data.updatedAt) || '') || 0;
        const defaultTs = Date.parse(defaultRow.updated_at || (defaultRow.data && defaultRow.data.updatedAt) || '') || 0;
        chosenRow = defaultTs > exactTs ? defaultRow : exactRow;
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
        const authoritativeUpdatedAt = chosenRow.updated_at || baseData.updatedAt || new Date().toISOString();
        baseData.updatedAt = authoritativeUpdatedAt;
        return res.status(200).json({
          configured: true,
          accountId: recordId,
          sourceRowId: chosenRow.id,
          updatedAt: authoritativeUpdatedAt,
          data: baseData
        });
      }

      return res.status(200).json({ configured: true, accountId: recordId, updatedAt: null, data: null });
    } catch (e) {
      return res.status(200).json({ configured: true, accountId: recordId, updatedAt: null, data: null });
    }
  }

  if (req.method === 'POST') {
    try {
      // Stamp authoritative server timestamp and upsert both user_<email> and default so web & mobile stay 100% synced
      const nowIso = new Date().toISOString();
      const payloadToStore = { ...bodyObj, updatedAt: nowIso };
      const upsertRows = [{ id: recordId, data: payloadToStore, updated_at: nowIso }];
      if (recordId !== 'default') {
        upsertRows.push({ id: 'default', data: payloadToStore, updated_at: nowIso });
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
      return res.status(200).json({ configured: true, accountId: recordId, saved: true, updatedAt: nowIso });
    } catch (e) {
      return res.status(200).json({ configured: true, accountId: recordId, saved: false, updatedAt: null });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
