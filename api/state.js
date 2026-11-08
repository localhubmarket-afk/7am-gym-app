// Vercel Serverless Function: /api/state
// Automatically merges workoutLogs & usmcLogs from `id = 'default'` and any earlier François sign-in rows
// so signing in multiple times never splits your Week 1 history across multiple rows!
export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

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
      // Fetch all rows from gym_state so we can merge 'default' (last week's pre-login data) with François's active row
      const rAll = await fetch(supabaseUrl + '/rest/v1/gym_state?select=id,data,updated_at', {
        headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey }
      });
      const allRows = await rAll.json();
      if (!Array.isArray(allRows) || allRows.length === 0) {
        return res.status(200).json({ configured: true, accountId: recordId, data: null });
      }

      const exactRow = allRows.find(row => row.id === recordId);
      const defaultRow = allRows.find(row => row.id === 'default');
      let baseData = (exactRow && exactRow.data)
        ? exactRow.data
        : (defaultRow && defaultRow.data ? defaultRow.data : (allRows[0] && allRows[0].data ? allRows[0].data : null));

      if (baseData && typeof baseData === 'object') {
        if (!baseData.workoutLogs) baseData.workoutLogs = {};
        if (!baseData.usmcLogs) baseData.usmcLogs = {};

        // Merge any logged sets from 'default' and any other François row so no sets from last week are ever stranded
        allRows.forEach(row => {
          const d = row && row.data;
          if (!d || typeof d !== 'object') return;
          if (d.workoutLogs && typeof d.workoutLogs === 'object') {
            Object.keys(d.workoutLogs).forEach(k => {
              const incoming = d.workoutLogs[k];
              const existing = baseData.workoutLogs[k];
              if (incoming && (incoming.done || (incoming.weight && incoming.weight !== '0'))) {
                if (!existing || !existing.done || !existing.weight || existing.weight === '0') {
                  baseData.workoutLogs[k] = incoming;
                }
              }
            });
          }
          if (d.usmcLogs && typeof d.usmcLogs === 'object') {
            Object.keys(d.usmcLogs).forEach(k => {
              const incoming = d.usmcLogs[k];
              const existing = baseData.usmcLogs[k];
              if (incoming && incoming.done && (!existing || !existing.done)) {
                baseData.usmcLogs[k] = incoming;
              }
            });
          }
        });
      }

      return res.status(200).json({ configured: true, accountId: recordId, data: baseData });
    } catch (e) {
      return res.status(200).json({ configured: true, accountId: recordId, data: null });
    }
  }

  if (req.method === 'POST') {
    try {
      // Upsert into both the user's recordId AND 'default' so François's primary profile and default backup stay 100% in sync
      const nowIso = new Date().toISOString();
      const upsertRows = [{ id: recordId, data: bodyObj, updated_at: nowIso }];
      if (recordId !== 'default') {
        upsertRows.push({ id: 'default', data: bodyObj, updated_at: nowIso });
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
      return res.status(200).json({ configured: true, accountId: recordId, saved: true });
    } catch (e) {
      return res.status(200).json({ configured: true, accountId: recordId, saved: false });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
