// Vercel Serverless Function: /api/auth-lead
// 1. POST /api/auth-lead -> Saves user sign-in profile to Supabase `leads_profiles` table
// 2. GET /api/auth-lead?admin_key=YOUR_ADMIN_SECRET&format=csv -> Backend-only owner export of all leads!
export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json({ configured: false, saved: false });
  }

  // Backend-only Admin Export (Protected by ADMIN_SECRET in Vercel Environment Variables)
  if (req.method === 'GET') {
    const adminSecret = process.env.ADMIN_SECRET;
    const providedKey = req.query ? req.query.admin_key : '';
    if (!adminSecret || providedKey !== adminSecret) {
      return res.status(401).json({ error: 'Unauthorized: Valid ADMIN_SECRET required on backend.' });
    }
    try {
      const r = await fetch(supabaseUrl + '/rest/v1/leads_profiles?select=*&order=created_at.desc', {
        headers: {
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey
        }
      });
      const leads = await r.json();
      if (req.query && req.query.format === 'csv') {
        const header = 'Name,Email,Phone,Goal,Diet,Gym_Time,Created_At\n';
        const rows = (Array.isArray(leads) ? leads : []).map(l =>
          [l.name, l.email, l.phone, l.goal, l.diet, l.gym_time, l.created_at]
            .map(v => '"' + String(v || '').replace(/"/g, '""') + '"')
            .join(',')
        ).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="leads_profiles.csv"');
        return res.status(200).send(header + rows);
      }
      return res.status(200).json({ count: Array.isArray(leads) ? leads.length : 0, leads });
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  // User Sign-In Lead & Profile Save
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const lead = body.lead;
      const state = body.state;
      if (lead && lead.email) {
        await fetch(supabaseUrl + '/rest/v1/leads_profiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': 'Bearer ' + supabaseKey,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            email: lead.email.toLowerCase(),
            name: lead.name || '',
            phone: lead.phone || '',
            goal: lead.goal || '6-Pack Recomp',
            diet: lead.diet || '100% Plant-Based ($5.55/day)',
            gym_time: lead.gymTime || '07:00',
            created_at: lead.capturedAt || new Date().toISOString()
          })
        });
      }
      if (lead && lead.email && state) {
        await fetch(supabaseUrl + '/rest/v1/gym_state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': 'Bearer ' + supabaseKey,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            id: 'user_' + lead.email.toLowerCase(),
            data: state,
            updated_at: new Date().toISOString()
          })
        });
      }
      return res.status(200).json({ configured: true, saved: true });
    } catch (err) {
      return res.status(200).json({ configured: true, saved: false, error: String(err) });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
