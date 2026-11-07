// Vercel Serverless Function: /api/gemini
// Set GEMINI_API_KEY in Vercel -> Project Settings -> Environment Variables
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ configured: false, reply: null });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const model = body.model || 'gemini-3.8-flash';
    const prompt = body.prompt || '';
    const systemInstruction = body.systemInstruction || '';
    const modelsToTry = [model, 'gemini-3.8-flash', 'gemini-2.5-flash'];
    let lastErr = null;

    for (const m of modelsToTry) {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(m) + ':generateContent?key=' + encodeURIComponent(apiKey);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        })
      });
      if (response.ok) {
        const data = await response.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (reply) {
          return res.status(200).json({ configured: true, model: m, reply });
        }
      } else {
        lastErr = await response.text();
      }
    }
    return res.status(200).json({ configured: true, reply: null, error: lastErr });
  } catch (err) {
    return res.status(200).json({ configured: true, reply: null, error: String(err) });
  }
}
