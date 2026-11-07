// Vercel Serverless Function: /api/state
export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json({ configured: false });
  }

  if (req.method === 'GET') {
    try {
      const r = await fetch(supabaseUrl + '/rest/v1/gym_state?id=eq.default&select=data', {
        headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey }
      });
      const rows = await r.json();
      return res.status(200).json({ configured: true, data: rows?.[0]?.data || null });
    } catch (e) {
      return res.status(200).json({ configured: true, data: null });
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
          id: 'default',
          data: req.body,
          updated_at: new Date().toISOString()
        })
      });
      return res.status(200).json({ configured: true, saved: true });
    } catch (e) {
      return res.status(200).json({ configured: true, saved: false });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
