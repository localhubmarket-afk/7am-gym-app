// Vercel Serverless Function: /api/auth-lead
// Saves captured user leads (name, email, phone, goal, diet, gymTime) to Supabase `leads_profiles`
export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json({ configured: false, saved: false });
  }

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
