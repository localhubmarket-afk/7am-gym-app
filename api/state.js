// Vercel Serverless Function: /api/state
// Automatically falls back to `id = 'default'` if the primary profile's `user_<email>` row is empty so last week's cloud data is automatically linked to your profile!
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
      const r = await fetch(supabaseUrl + '/rest/v1/gym_state?id=eq.' + encodeURIComponent(recordId) + '&select=data', {
        headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey }
      });
      const rows = await r.json();
      let data = rows?.[0]?.data || null;

      // If no logs exist under user_<email> yet, fall back to 'default' (where last week's pre-login data was stored!)
      if ((!data || !data.workoutLogs || Object.keys(data.workoutLogs).length === 0) && recordId !== 'default') {
        const rDef = await fetch(supabaseUrl + '/rest/v1/gym_state?id=eq.default&select=data', {
          headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey }
        });
        const defRows = await rDef.json();
        if (defRows?.[0]?.data) {
          data = defRows[0].data;
        }
      }
      return res.status(200).json({ configured: true, accountId: recordId, data });
    } catch (e) {
      return res.status(200).json({ configured: true, accountId: recordId, data: null });
    }
  }

  if (req.method === 'POST') {
    try {
      await fetch(supabaseUrl + '/rest/v1/gym_state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: recordId,
          data: bodyObj,
          updated_at: new Date().toISOString()
        })
      });
      return res.status(200).json({ configured: true, accountId: recordId, saved: true });
    } catch (e) {
      return res.status(200).json({ configured: true, accountId: recordId, saved: false });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
