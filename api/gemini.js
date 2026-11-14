// Vercel Serverless Function: /api/gemini
// Supports text coaching, multimodal machine photo vision & video lookup, and shoe recognition via gemini-3.8-flash
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ configured: false, reply: null, text: null });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const requestedModel = (!body.model || body.model === 'gemini-2.5-flash') ? 'gemini-3.8-flash' : body.model;
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

    const contentsPayload = (Array.isArray(body.contents) && body.contents.length > 0)
      ? body.contents
      : [{ role: 'user', parts: userParts }];

    const enableGoogleSearch = body.enableGoogleSearch !== false;
    const modelsToTry = Array.from(new Set([requestedModel, 'gemini-3.8-flash', 'gemini-4-hydrogen']));
    let lastErr = null;

    for (const m of modelsToTry) {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(m) + ':generateContent?key=' + encodeURIComponent(apiKey);
      const reqPayload = {
        systemInstruction: systemInstruction
          ? (typeof systemInstruction === 'object' ? systemInstruction : { parts: [{ text: String(systemInstruction) }] })
          : undefined,
        contents: contentsPayload,
        tools: enableGoogleSearch ? [{ googleSearch: {} }] : undefined
      };
      let response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'aistudio-build' },
        body: JSON.stringify(reqPayload)
      });
      if (!response.ok && enableGoogleSearch) {
        delete reqPayload.tools;
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'aistudio-build' },
          body: JSON.stringify(reqPayload)
        });
      }
      if (response.ok) {
        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const reply = parts.map(p => p.text || '').join('\n').trim();
        const groundingChunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        if (reply) {
          return res.status(200).json({ configured: true, model: m, reply, text: reply, groundingChunks });
        }
      } else {
        lastErr = await response.text();
      }
    }
    return res.status(200).json({ configured: true, reply: null, text: null, error: lastErr });
  } catch (err) {
    return res.status(200).json({ configured: true, reply: null, text: null, error: String(err) });
  }
}
