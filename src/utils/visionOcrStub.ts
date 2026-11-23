export type OcrScanMode = 'weight_machine' | 'nutrition_label';

export interface WeightMachineOcrResult {
  mode: 'weight_machine';
  detectedWeight: number;
  unit: 'lbs' | 'kg';
  confidence: number;
  rawText: string;
  stubNote: string;
}

export interface NutritionLabelOcrResult {
  mode: 'nutrition_label';
  itemName: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  servingSize: string;
  confidence: number;
  rawText: string;
  stubNote: string;
}

export type VisionOcrResult = WeightMachineOcrResult | NutritionLabelOcrResult;

export interface CameraStreamHandle {
  active: boolean;
  stream: MediaStream | null;
  error: string | null;
  stop: () => void;
}

export async function startDeviceCameraStream(): Promise<CameraStreamHandle> {
  try {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      return {
        active: false,
        stream: null,
        error: 'Camera is not available in this browser. You can upload a photo or use a test scan below.',
        stop: () => {}
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });

    return {
      active: true,
      stream,
      error: null,
      stop: () => {
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch {
          // Ignore teardown errors
        }
      }
    };
  } catch (err) {
    return {
      active: false,
      stream: null,
      error:
        err instanceof Error
          ? `Camera access blocked (${err.message}). Upload a photo or use the test scan.`
          : 'Camera access blocked. Upload a photo or use the test scan.',
      stop: () => {}
    };
  }
}

export function parseWeightStackText(rawText: string, fallbackUnit: 'lbs' | 'kg' = 'lbs'): {
  weight: number;
  unit: 'lbs' | 'kg';
} {
  const text = String(rawText || '');
  const match = text.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|lb|lbs)?/i);
  if (!match) {
    return { weight: fallbackUnit === 'kg' ? 45 : 100, unit: fallbackUnit };
  }
  const weight = parseFloat(match[1]);
  const rawUnit = (match[2] || '').toLowerCase();
  const unit: 'lbs' | 'kg' = rawUnit.startsWith('kg') ? 'kg' : rawUnit.startsWith('lb') ? 'lbs' : fallbackUnit;
  return {
    weight: Number.isFinite(weight) && weight > 0 ? Math.min(1500, weight) : 100,
    unit
  };
}

export function parseNutritionLabelText(rawText: string): {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  servingSize: string;
} {
  const text = String(rawText || '');
  const calMatch = text.match(/calories?\s*[:\-]?\s*(\d+)/i);
  const proMatch = text.match(/protein\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i);
  const carbMatch = text.match(/(?:total\s+)?carb(?:ohydrate)?s?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i);
  const fatMatch = text.match(/(?:total\s+)?fat\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i);
  const servMatch = text.match(/serving\s+size\s*[:\-]?\s*([^\n,;]+)/i);

  return {
    calories: calMatch ? parseInt(calMatch[1], 10) : 240,
    proteinGrams: proMatch ? parseFloat(proMatch[1]) : 28,
    carbsGrams: carbMatch ? parseFloat(carbMatch[1]) : 18,
    fatGrams: fatMatch ? parseFloat(fatMatch[1]) : 6,
    servingSize: servMatch ? servMatch[1].trim() : '1 serving (100g)'
  };
}

export async function scanWeightMachineStackOCR(input?: {
  imageDataUrl?: string | null;
  simulatedLabelText?: string;
  preferredUnit?: 'lbs' | 'kg';
}): Promise<WeightMachineOcrResult> {
  const unit = input?.preferredUnit === 'kg' ? 'kg' : 'lbs';
  const rawText =
    input?.simulatedLabelText ||
    (unit === 'kg' ? 'PIN STACK 52.5 KG' : 'PIN STACK 115 LBS');
  const parsed = parseWeightStackText(rawText, unit);

  return {
    mode: 'weight_machine',
    detectedWeight: parsed.weight,
    unit: parsed.unit,
    confidence: 0.94,
    rawText,
    stubNote: 'OCR Vision Stub active — ready to connect to Tesseract.js or Cloud Vision API.'
  };
}

export async function scanNutritionLabelOCR(input?: {
  imageDataUrl?: string | null;
  simulatedLabelText?: string;
  itemNameHint?: string;
}): Promise<NutritionLabelOcrResult> {
  const rawText =
    input?.simulatedLabelText ||
    'Serving Size: 1 block (150g)\nCalories: 210\nTotal Fat: 11g\nTotal Carbohydrates: 4g\nProtein: 24g';
  const parsed = parseNutritionLabelText(rawText);

  return {
    mode: 'nutrition_label',
    itemName: input?.itemNameHint || 'Scanned High-Protein Food',
    calories: parsed.calories,
    proteinGrams: parsed.proteinGrams,
    carbsGrams: parsed.carbsGrams,
    fatGrams: parsed.fatGrams,
    servingSize: parsed.servingSize,
    confidence: 0.92,
    rawText,
    stubNote: 'OCR Vision Stub active — ready to connect to Tesseract.js or Cloud Vision API.'
  };
}
