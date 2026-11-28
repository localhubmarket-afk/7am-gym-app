import React, { useEffect, useRef, useState } from 'react';
import {
  createBrowserSpeechRecognizer,
  isWebSpeechRecognitionSupported,
  parseSpokenSetPhrase,
  type BrowserSpeechRecognitionHandle,
  type ParsedVoiceSetLog,
  type VoiceLogUndoRecord,
  type VoiceWeightUnit
} from '../utils/voiceToLog';

export interface VoiceToLogPanelProps {
  activeExerciseName: string;
  activeSetNumber: number;
  defaultUnit?: VoiceWeightUnit;
  lastUndoRecord: VoiceLogUndoRecord | null;
  onLogParsedPhrase: (parsed: ParsedVoiceSetLog) => void | Promise<void>;
  onUndoLastVoiceLog: (record: VoiceLogUndoRecord) => void | Promise<void>;
}

/**
 * Phase 2 — Task 1: Hands-Free Voice-to-Log Interface
 * - Uses Browser Web Speech API with clear Grade 6-8 status cues.
 * - Includes an accessible phrase text fallback when microphone hardware is unavailable.
 * - Immediately reveals a high-contrast 1-tap "Undo Voice Log" button (>= 48x48px)
 *   that reverts both local state and Supabase.
 */
export const VoiceToLogPanel: React.FC<VoiceToLogPanelProps> = ({
  activeExerciseName,
  activeSetNumber,
  defaultUnit = 'lbs',
  lastUndoRecord,
  onLogParsedPhrase,
  onUndoLastVoiceLog
}) => {
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [manualPhrase, setManualPhrase] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const recognizerRef = useRef<BrowserSpeechRecognitionHandle | null>(null);

  useEffect(() => {
    setSpeechSupported(isWebSpeechRecognitionSupported());
    return () => {
      recognizerRef.current?.stop();
    };
  }, []);

  const processTranscript = async (phrase: string) => {
    setErrorMessage(null);
    const parsed = parseSpokenSetPhrase(phrase, defaultUnit);
    if (!parsed.ok) {
      setErrorMessage(parsed.errorMessage || 'Could not understand that set.');
      return;
    }
    setLiveTranscript(parsed.transcript);
    await onLogParsedPhrase(parsed);
    setStatusMessage(
      `Saved ${parsed.reps} reps${parsed.weight !== null ? ` at ${parsed.weight} ${parsed.unit}` : ''} to ${activeExerciseName} (Set ${parsed.setNumberHint ?? activeSetNumber}).`
    );
    setManualPhrase('');
  };

  const handleToggleListening = () => {
    setErrorMessage(null);
    if (isListening) {
      recognizerRef.current?.stop();
      setIsListening(false);
      return;
    }

    const handle = createBrowserSpeechRecognizer({
      lang: 'en-US',
      onStart: () => {
        setIsListening(true);
        setStatusMessage('Listening now. Say: "Did 10 reps at 45 pounds".');
      },
      onInterimTranscript: (text) => {
        setLiveTranscript(text);
      },
      onFinalTranscript: (text) => {
        setIsListening(false);
        void processTranscript(text);
      },
      onError: (friendlyMsg) => {
        setIsListening(false);
        setErrorMessage(friendlyMsg);
      },
      onEnd: () => {
        setIsListening(false);
      }
    });

    recognizerRef.current = handle;
    handle.start();
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await processTranscript(manualPhrase);
  };

  const handleUndoClick = async () => {
    if (!lastUndoRecord || isUndoing) return;
    setIsUndoing(true);
    setErrorMessage(null);
    try {
      await onUndoLastVoiceLog(lastUndoRecord);
      setStatusMessage(`Undid Set ${lastUndoRecord.setNumber} of ${lastUndoRecord.exerciseName} on this device and in the cloud.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not undo that set.');
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <section
      aria-label="Hands-free voice set logging"
      data-testid="voice-to-log-panel"
      className="rounded-xl border border-emerald-500/45 bg-slate-900 p-4 text-left text-slate-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-white">Hands-Free Voice Log</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
            Next up: <strong className="text-emerald-200">{activeExerciseName}</strong> · Set {activeSetNumber}
          </p>
        </div>
        <span className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[0.6875rem] font-extrabold text-emerald-200">
          {speechSupported ? 'Mic Ready' : 'Type or Speak'}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-200">
        Tap the button and say a short phrase like{' '}
        <span className="font-bold text-white">&ldquo;Did 10 reps at 45 pounds&rdquo;</span>.
      </p>

      <div className="mt-3 flex flex-col gap-2.5">
        <button
          type="button"
          data-testid="voice-log-mic-btn"
          onClick={handleToggleListening}
          aria-pressed={isListening}
          className={`min-h-[48px] w-full rounded-xl px-4 py-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            isListening
              ? 'border-2 border-rose-300 bg-rose-600 text-white hover:bg-rose-500'
              : 'border border-emerald-400/70 bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
        >
          {isListening ? 'Stop Listening' : 'Start Voice Log (Hands-Free)'}
        </button>

        {/* Accessible text-phrase input so users without a mic or in quiet gyms can still use phrase logging */}
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="voice-phrase-fallback-input" className="sr-only">
            Type or test a spoken set phrase
          </label>
          <input
            id="voice-phrase-fallback-input"
            name="voice_set_phrase_note"
            data-testid="voice-phrase-input"
            type="text"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            value={manualPhrase}
            onChange={(e) => setManualPhrase(e.target.value)}
            placeholder='Try: "Did 10 reps at 45 pounds"'
            className="min-h-[48px] flex-1 rounded-xl border border-slate-500 bg-slate-950 px-3.5 py-2 text-base font-semibold text-white placeholder:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          />
          <button
            type="submit"
            data-testid="voice-phrase-submit-btn"
            className="min-h-[48px] min-w-[120px] rounded-xl border border-sky-400/60 bg-sky-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Log Phrase
          </button>
        </form>
      </div>

      {liveTranscript && (
        <div
          role="status"
          aria-live="polite"
          className="mt-2.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
        >
          <span className="font-bold text-slate-400">Heard: </span>
          <span className="font-semibold text-white">&ldquo;{liveTranscript}&rdquo;</span>
        </div>
      )}

      {statusMessage && (
        <p
          role="status"
          aria-live="polite"
          data-testid="voice-log-status"
          className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-xs font-bold leading-relaxed text-emerald-200"
        >
          {statusMessage}
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          data-testid="voice-log-error"
          className="mt-2 rounded-lg border border-rose-500/50 bg-rose-950/60 px-3 py-2 text-xs font-bold leading-relaxed text-rose-100"
        >
          {errorMessage}
        </p>
      )}

      {/* Prominent 1-Tap Undo Banner */}
      {lastUndoRecord && (
        <div
          role="region"
          aria-label="Undo last voice logged set"
          data-testid="voice-log-undo-banner"
          className="mt-3 rounded-xl border-2 border-amber-400 bg-amber-950/70 p-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs leading-relaxed text-amber-100">
              <div className="font-extrabold text-white">Voice Set Saved</div>
              <div>
                {lastUndoRecord.exerciseName} · Set {lastUndoRecord.setNumber}:{' '}
                <strong>
                  {lastUndoRecord.loggedReps} reps at{' '}
                  {lastUndoRecord.loggedWeight > 0
                    ? `${lastUndoRecord.loggedWeight} ${lastUndoRecord.unit}`
                    : 'Bodyweight'}
                </strong>
              </div>
            </div>
            <button
              type="button"
              data-testid="voice-log-undo-btn"
              disabled={isUndoing}
              onClick={handleUndoClick}
              className="min-h-[48px] min-w-[140px] shrink-0 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {isUndoing ? 'Undoing...' : 'Undo Voice Log'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
