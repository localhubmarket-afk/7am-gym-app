import React, { useEffect, useRef, useState } from 'react';
import {
  scanNutritionLabelOCR,
  scanWeightMachineStackOCR,
  startDeviceCameraStream,
  type CameraStreamHandle,
  type OcrScanMode,
  type VisionOcrResult
} from '../utils/visionOcrStub';

export interface CameraScannerModalProps {
  isOpen: boolean;
  mode: OcrScanMode;
  contextLabel?: string;
  preferredUnit?: 'lbs' | 'kg';
  onApplyResult: (result: VisionOcrResult) => void;
  onClose: () => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  mode,
  contextLabel,
  preferredUnit = 'lbs',
  onApplyResult,
  onClose
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraHandleRef = useRef<CameraStreamHandle | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [labelHint, setLabelHint] = useState<string>('');
  const [scanResult, setScanResult] = useState<VisionOcrResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setScanResult(null);
    setCameraError('');

    startDeviceCameraStream().then((handle) => {
      if (!active) {
        handle.stop();
        return;
      }
      cameraHandleRef.current = handle;
      if (handle.active && handle.stream && videoRef.current) {
        videoRef.current.srcObject = handle.stream;
      } else if (handle.error) {
        setCameraError(handle.error);
      }
    });

    return () => {
      active = false;
      cameraHandleRef.current?.stop();
      cameraHandleRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  async function runScan(imageDataUrl: string | null) {
    if (mode === 'weight_machine') {
      const res = await scanWeightMachineStackOCR({
        imageDataUrl,
        simulatedLabelText: labelHint.trim() || undefined,
        preferredUnit
      });
      setScanResult(res);
    } else {
      const res = await scanNutritionLabelOCR({
        imageDataUrl,
        simulatedLabelText: labelHint.trim() || undefined
      });
      setScanResult(res);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Camera Vision OCR Scanner"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-white">
            {mode === 'weight_machine'
              ? `Scan Pin Stack (${contextLabel || 'Machine'})`
              : 'Scan Nutrition Facts Label'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera scanner modal"
            className="min-h-[48px] min-w-[48px] rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-100 hover:bg-slate-700"
          >
            ✕ Close
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-slate-600 bg-slate-950 p-3">
          {!cameraError ? (
            <video ref={videoRef} autoPlay playsInline muted className="h-44 w-full rounded-lg object-cover" />
          ) : (
            <p className="text-base leading-relaxed text-slate-200">{cameraError}</p>
          )}
        </div>

        <input
          type="text"
          name="camera_ocr_label_note"
          aria-label="Optional scanner test text"
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          value={labelHint}
          onChange={(e) => setLabelHint(e.target.value)}
          placeholder={
            mode === 'weight_machine'
              ? 'Optional OCR text test (e.g. Stack 125 LBS)'
              : 'Optional label text test (e.g. Calories: 220, Protein: 26g)'
          }
          className="mt-3 min-h-[48px] w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-base text-white placeholder-slate-300"
        />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void runScan(null)}
            className="min-h-[48px] flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-sky-500"
          >
            📷 Scan Now
          </button>
        </div>

        {scanResult && (
          <div className="mt-3 rounded-xl border border-emerald-500/50 bg-emerald-950/40 p-3">
            <div className="text-sm font-extrabold text-emerald-200">
              {scanResult.mode === 'weight_machine'
                ? `✓ Detected Pin Weight: ${scanResult.detectedWeight} ${scanResult.unit.toUpperCase()}`
                : `✓ Detected: ${scanResult.calories} kcal • ${scanResult.proteinGrams}g Protein`}
            </div>
            <button
              type="button"
              onClick={() => {
                onApplyResult(scanResult);
                onClose();
              }}
              className="mt-2.5 min-h-[48px] w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500"
            >
              Use Scanned Value
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
