// Server-side Gemini API handler using @google/genai SDK
// Supports:
// 1. Bounded Plain-Language Coach (action: "coach_explain") — explains deterministic math only
// 2. Low-Spoons Triage Classifier (action: "low_spoons_triage") — returns strict severity enum
// 3. Existing text coaching, multimodal vision, and JSON generation workflows
import { GoogleGenAI, Type } from '@google/genai';

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const RETRY_FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const ALLOWED_LOW_SPOONS_TIERS = [
  'normal_energy',
  'mild_fatigue',
  'high_fatigue_or_overload',
  'severe_sensory_overload'
];

const PLAIN_LANGUAGE_COACH_INSTRUCTION = [
  'You are a warm, calm fitness coach explaining already-finished workout math to a neurodivergent user.',
  'STRICT RULES:',
  '1. Write at a Grade 6 to 8 reading level. Use short, clear sentences and everyday words.',
  '2. NEVER calculate new numbers, NEVER change the weight, NEVER change the reps or sets.',
  '3. Only explain the exact numbers in the provided mathSnapshot JSON.',
  '4. Write 2 or 3 short sentences for "explanation" and 1 short sentence for "keyTakeaway".',
  '5. Never use guilt, shame, streaks, or jargon like "RPE", "RIR", "periodization", or "hypertrophy".'
].join('\n');

const LOW_SPOONS_TRIAGE_INSTRUCTION = [
  'You classify a user\'s daily energy, fatigue, or sensory overload check-in for an accessible gym app.',
  'STRICT RULES:',
  '1. Choose EXACTLY ONE severityTier from this list:',
  '   - "normal_energy": User feels fine, rested, ready, or mentions normal/good energy.',
  '   - "mild_fatigue": User feels a little tired, low sleep, mildly sore, or low motivation.',
  '   - "high_fatigue_or_overload": User feels very tired, drained, brain-fogged, overstimulated, bothered by bright lights/noise, or mentions low spoons.',
  '   - "severe_sensory_overload": User feels completely burnt out, overwhelmed, panicky, dizzy, exhausted, or in heavy sensory overload.',
  '2. NEVER prescribe custom exercises, custom weights, or custom set numbers.',
  '3. Write a 1 to 2 sentence Grade 6-8 guilt-free "reassurance" confirming that scaling today is a smart win.'
].join('\n');

function createServerGeminiClient(apiKey) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientUpstreamError(err) {
  const status = err && typeof err.status === 'number' ? err.status : 0;
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const msg = String(err instanceof Error ? err.message : err || '');
  return /\b(503|502|504|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand)\b/i.test(msg);
}

/**
 * Formats upstream Gemini errors into calm, Grade 6-8 plain English without raw JSON dumps.
 */
function formatFriendlyGeminiError(err) {
  const status = err && typeof err.status === 'number' ? err.status : 0;
  const raw = String(err instanceof Error ? err.message : err || '');

  if (status === 503 || /503|UNAVAILABLE|high demand/i.test(raw)) {
    return 'The AI coach is very busy right now. Please wait a few seconds and tap Try Again.';
  }
  if (status === 429 || /429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return 'The AI coach hit its rate limit for this minute. Please wait a moment and try again.';
  }
  if (status === 401 || status === 403 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(raw)) {
    return 'The server Gemini API key needs to be checked in Settings > Secrets.';
  }
  // Extract message field if upstream sent a JSON string
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      const innerMsg = parsed?.error?.message || parsed?.message;
      if (typeof innerMsg === 'string' && innerMsg.trim()) {
        return innerMsg.trim();
      }
    } catch {
      // Fall through to calm default
    }
  }
  return 'Could not reach the AI coach right now. Please tap Try Again in a moment.';
}

/**
 * Calls ai.models.generateContent with exponential backoff retry on transient 503/429
 * spikes, falling back from gemini-4-hydrogen to gemini-3.1-flash-lite if overloaded.
 */
async function generateContentWithRetry(ai, primaryModel, params) {
  const attempts = [
    { model: primaryModel, waitBeforeMs: 0 },
    { model: primaryModel, waitBeforeMs: 500 },
    { model: primaryModel === RETRY_FALLBACK_MODEL ? PRIMARY_MODEL : RETRY_FALLBACK_MODEL, waitBeforeMs: 900 }
  ];

  let lastError = null;
  for (const attempt of attempts) {
    if (attempt.waitBeforeMs > 0) {
      await delay(attempt.waitBeforeMs);
    }
    try {
      const response = await ai.models.generateContent({
        model: attempt.model,
        ...params
      });
      return { response, modelUsed: attempt.model };
    } catch (err) {
      lastError = err;
      if (!isTransientUpstreamError(err)) {
        throw err;
      }
    }
  }
  throw lastError;
}

function sanitizeCoachMathSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const safeNum = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    exerciseName: String(raw.exerciseName || 'Exercise').slice(0, 80),
    action: ['increase_weight', 'increase_reps', 'hold_and_build', 'start_baseline'].includes(raw.action)
      ? raw.action
      : 'hold_and_build',
    previousWeight: safeNum(raw.previousWeight),
    previousReps: safeNum(raw.previousReps),
    previousCompletedSets: Math.max(0, Math.min(20, Math.floor(Number(raw.previousCompletedSets) || 0))),
    targetSets: Math.max(1, Math.min(20, Math.floor(Number(raw.targetSets) || 3))),
    minReps: Math.max(1, Math.min(100, Math.floor(Number(raw.minReps) || 8))),
    maxReps: Math.max(1, Math.min(100, Math.floor(Number(raw.maxReps) || 12))),
    nextTargetWeight: Math.max(0, Math.min(2000, Number(raw.nextTargetWeight) || 0)),
    nextTargetReps: Math.max(1, Math.min(100, Math.floor(Number(raw.nextTargetReps) || 8))),
    weightDelta: Number.isFinite(Number(raw.weightDelta)) ? Number(raw.weightDelta) : 0,
    unit: raw.unit === 'kg' ? 'kg' : 'lbs',
    biometricSleepHours: safeNum(raw.biometricSleepHours),
    biometricRestingHrBpm: safeNum(raw.biometricRestingHrBpm),
    deterministicSummary: String(raw.deterministicSummary || '').slice(0, 400)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      configured: false,
      reply: null,
      text: null,
      error: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const ai = createServerGeminiClient(apiKey);
    const action = String(body.action || '').trim().toLowerCase();

    // 1. Bounded Plain-Language Coach (Task 2)
    if (action === 'coach_explain') {
      const snapshot = sanitizeCoachMathSnapshot(body.mathSnapshot);
      if (!snapshot) {
        return res.status(400).json({
          ok: false,
          configured: true,
          error: 'Valid deterministic mathSnapshot is required.'
        });
      }

      const { response, modelUsed } = await generateContentWithRetry(ai, PRIMARY_MODEL, {
        contents: `Explain this locked deterministic workout math in Grade 6-8 plain language without changing any numbers:\n${JSON.stringify(snapshot)}`,
        config: {
          systemInstruction: PLAIN_LANGUAGE_COACH_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: {
                type: Type.STRING,
                description: '2-3 short Grade 6-8 sentences explaining the exact provided numbers.'
              },
              keyTakeaway: {
                type: Type.STRING,
                description: '1 short, encouraging plain-language takeaway sentence.'
              }
            },
            required: ['explanation', 'keyTakeaway']
          }
        }
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      const explanation = typeof parsed.explanation === 'string' ? parsed.explanation.trim() : '';
      const keyTakeaway = typeof parsed.keyTakeaway === 'string' ? parsed.keyTakeaway.trim() : '';
      if (!explanation) {
        return res.status(502).json({
          ok: false,
          configured: true,
          model: modelUsed,
          error: 'The AI coach returned an empty answer. Please tap Try Again.'
        });
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        model: modelUsed,
        explanation,
        keyTakeaway,
        reply: explanation,
        text: explanation,
        mathWasAltered: false
      });
    }

    // 2. Low-Spoons Triage Classifier (Task 3)
    if (action === 'low_spoons_triage') {
      const checkInText = String(body.checkInText || '').trim().slice(0, 600);
      if (!checkInText) {
        return res.status(400).json({
          ok: false,
          configured: true,
          error: 'Please enter how you are feeling today.'
        });
      }

      const { response, modelUsed } = await generateContentWithRetry(ai, PRIMARY_MODEL, {
        contents: `Classify this user check-in strictly into one severityTier:\n"${checkInText}"`,
        config: {
          systemInstruction: LOW_SPOONS_TRIAGE_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              severityTier: {
                type: Type.STRING,
                enum: ALLOWED_LOW_SPOONS_TIERS,
                description: 'Pre-validated fatigue or sensory overload severity tier.'
              },
              reassurance: {
                type: Type.STRING,
                description: '1-2 short Grade 6-8 guilt-free sentences validating how the user feels.'
              }
            },
            required: ['severityTier', 'reassurance']
          }
        }
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      const tier = ALLOWED_LOW_SPOONS_TIERS.includes(parsed.severityTier)
        ? parsed.severityTier
        : 'mild_fatigue';
      const reassurance =
        typeof parsed.reassurance === 'string' && parsed.reassurance.trim()
          ? parsed.reassurance.trim()
          : 'Listening to your energy today is a smart win.';

      return res.status(200).json({
        ok: true,
        configured: true,
        model: modelUsed,
        severityTier: tier,
        reassurance
      });
    }

    // 3. Existing general prompt / multimodal vision / JSON generation endpoint
    const deprecatedModels = new Set([
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
      'gemini-2.0-flash',
      'gemini-2.0-pro',
      'gemini-2.0-flash-thinking',
      'gemini-2.5-flash'
    ]);
    const requestedModel =
      !body.model || deprecatedModels.has(String(body.model).trim())
        ? PRIMARY_MODEL
        : String(body.model).trim();

    const prompt = String(body.prompt || '');
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

    const contentsPayload =
      Array.isArray(body.contents) && body.contents.length > 0
        ? body.contents
        : [{ role: 'user', parts: userParts }];

    const requestedResponseMimeType =
      body.responseMimeType ||
      body.response_mime_type ||
      (body.generationConfig &&
        (body.generationConfig.responseMimeType || body.generationConfig.response_mime_type)) ||
      '';
    const isJsonMode = requestedResponseMimeType === 'application/json';
    const enableGoogleSearch = !isJsonMode && body.enableGoogleSearch === true;
    const whitelistRule =
      'You MUST only select exercises from standard, scientifically validated movements (e.g., Barbell Squat, Cable Crunch). Do not invent names.';
    const combinedPromptText =
      `${prompt} ${typeof systemInstruction === 'string' ? systemInstruction : ''}`.toLowerCase();
    const isWorkoutJsonGen =
      isJsonMode &&
      (combinedPromptText.includes('exercise') ||
        combinedPromptText.includes('workout') ||
        combinedPromptText.includes('gym program'));

    const effectiveSystemInstruction = isWorkoutJsonGen
      ? typeof systemInstruction === 'string'
        ? `${systemInstruction.trim()}\n${whitelistRule}`.trim()
        : systemInstruction
      : systemInstruction;

    const config = {};
    if (effectiveSystemInstruction) {
      config.systemInstruction =
        typeof effectiveSystemInstruction === 'string'
          ? effectiveSystemInstruction
          : effectiveSystemInstruction?.parts?.[0]?.text || undefined;
    }
    if (isJsonMode) {
      config.responseMimeType = 'application/json';
    }
    if (enableGoogleSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const { response, modelUsed } = await generateContentWithRetry(ai, requestedModel, {
      contents: contentsPayload,
      config
    });

    const reply = (response.text || '').trim();
    const groundingChunks =
      response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    if (!reply) {
      return res.status(502).json({
        ok: false,
        configured: true,
        model: modelUsed,
        reply: null,
        text: null,
        error: 'The AI coach returned an empty answer. Please try again.'
      });
    }

    return res.status(200).json({
      ok: true,
      configured: true,
      model: modelUsed,
      reply,
      text: reply,
      groundingChunks
    });
  } catch (err) {
    const statusCode =
      err && typeof err.status === 'number' && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
    return res.status(statusCode).json({
      ok: false,
      configured: true,
      reply: null,
      text: null,
      error: formatFriendlyGeminiError(err)
    });
  }
}
