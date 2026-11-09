// Vercel Serverless Function: /api/gemini
// Supports both text coaching AND multimodal shoe photo brand/model recognition!
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
    const model = body.model || 'gemini-2.5-flash';
    const prompt = body.prompt || '';
    const systemInstruction = body.systemInstruction || '';
    const imageBase64 = body.imageBase64 || '';
    const mimeType = body.mimeType || 'image/jpeg';

    const userParts = [];
    if (imageBase64) {
      const cleanB64 = String(imageBase64).replace(/^data:image\/[a-zA-Z0-9+-]+;base64,/, '');
      userParts.push({
        inlineData: {
          mimeType,
          data: cleanB64
        }
      });
    }
    if (prompt) {
      userParts.push({ text: prompt });
    }

    const modelsToTry = imageBase64
      ? ['gemini-2.5-flash', 'gemini-3.8-flash', model]
      : [model, 'gemini-3.8-flash', 'gemini-2.5-flash'];
    let lastErr = null;

    for (const m of modelsToTry) {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(m) + ':generateContent?key=' + encodeURIComponent(apiKey);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          contents: [{ role: 'user', parts: userParts }]
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
