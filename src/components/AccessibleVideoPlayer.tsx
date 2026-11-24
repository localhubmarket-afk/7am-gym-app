import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALLOWED_PLAYBACK_RATES,
  BARBELL_SQUAT_MEDIA_SAMPLES,
  DEFAULT_ACCESSIBLE_VIDEO_SETTINGS,
  formatSecondsClock,
  getActiveLiteralStepAtTime,
  getActiveVttCaptionAtTime,
  parseWebVttCaptions,
  sanitizeMediaUrl,
  type AccessibleExerciseMediaItem,
  type AllowedPlaybackRate,
  type LiteralExerciseStep
} from '../utils/accessibleVideoMedia';

export interface AccessibleVideoPlayerProps {
  /** Exercise media item (defaults to the Barbell Squat sample JSON data) */
  media?: AccessibleExerciseMediaItem;
  /** Optional override for video URL */
  videoSrc?: string;
  /** Optional override for WebVTT caption content */
  vttCaptions?: string;
  /** Optional override for Grade 6-8 literal steps */
  literalSteps?: LiteralExerciseStep[];
  /** Defaults to true (looping) */
  defaultLoop?: boolean;
  /** Defaults to true (muted to prevent sensory startle) */
  defaultMuted?: boolean;
  /** Defaults to 0.5x slow-motion for motor learning & cognitive processing */
  defaultPlaybackRate?: AllowedPlaybackRate;
  /** Defaults to true (closed captions always on by default) */
  defaultCaptionsEnabled?: boolean;
  /** Optional auto-play toggle (respects prefers-reduced-motion) */
  autoPlay?: boolean;
  className?: string;
}

/**
 * Task 2: Reusable Neurodivergent-Accessible Video Player (<AccessibleVideoPlayer>)
 * - Defaults strictly to: looping (`loop = true`), muted (`muted = true`), `0.5x` slow-motion speed.
 * - Overlays Grade 6-8 literal text steps and synchronized `.vtt` closed captions.
 * - WCAG 2.2 AA / COGA compliant: >= 48x48px controls, visible focus rings, no drag-only scrubbing.
 */
export const AccessibleVideoPlayer: React.FC<AccessibleVideoPlayerProps> = ({
  media = BARBELL_SQUAT_MEDIA_SAMPLES[0],
  videoSrc,
  vttCaptions,
  literalSteps,
  defaultLoop = DEFAULT_ACCESSIBLE_VIDEO_SETTINGS.loop,
  defaultMuted = DEFAULT_ACCESSIBLE_VIDEO_SETTINGS.muted,
  defaultPlaybackRate = DEFAULT_ACCESSIBLE_VIDEO_SETTINGS.playbackRate,
  defaultCaptionsEnabled = DEFAULT_ACCESSIBLE_VIDEO_SETTINGS.captionsEnabled,
  autoPlay = false,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [isMuted, setIsMuted] = useState<boolean>(defaultMuted);
  const [isLooping, setIsLooping] = useState<boolean>(defaultLoop);
  const [playbackRate, setPlaybackRate] = useState<AllowedPlaybackRate>(defaultPlaybackRate);
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(defaultCaptionsEnabled);
  const [showFullScript, setShowFullScript] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(media.durationSeconds || 20);
  const [videoLoadFailed, setVideoLoadFailed] = useState<boolean>(false);

  const safeSrc = useMemo(
    () => sanitizeMediaUrl(videoSrc ?? media.videoUrl),
    [videoSrc, media.videoUrl]
  );

  const parsedCues = useMemo(
    () => parseWebVttCaptions(vttCaptions ?? media.vttCaptions),
    [vttCaptions, media.vttCaptions]
  );

  const steps = useMemo(
    () => (Array.isArray(literalSteps) && literalSteps.length > 0 ? literalSteps : media.literalSteps),
    [literalSteps, media.literalSteps]
  );

  const activeCaption = useMemo(
    () => getActiveVttCaptionAtTime(parsedCues, currentTime),
    [parsedCues, currentTime]
  );

  const activeStep = useMemo(
    () => getActiveLiteralStepAtTime(steps, currentTime),
    [steps, currentTime]
  );

  // Build an in-memory Blob URL for the native <track kind="captions"> element as well
  const vttTrackUrl = useMemo(() => {
    const rawVtt = vttCaptions ?? media.vttCaptions;
    if (typeof URL === 'undefined' || typeof Blob === 'undefined' || !rawVtt) return '';
    try {
      const blob = new Blob([rawVtt], { type: 'text/vtt;charset=utf-8' });
      return URL.createObjectURL(blob);
    } catch {
      return '';
    }
  }, [vttCaptions, media.vttCaptions]);

  useEffect(() => {
    return () => {
      if (vttTrackUrl && typeof URL !== 'undefined') {
        try {
          URL.revokeObjectURL(vttTrackUrl);
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [vttTrackUrl]);

  // Synchronize native HTML5 <video> element with muted, loop, and 0.5x playbackRate defaults
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.muted = isMuted;
    videoEl.loop = isLooping;
    videoEl.defaultPlaybackRate = playbackRate;
    videoEl.playbackRate = playbackRate;
  }, [isMuted, isLooping, playbackRate]);

  // Graceful guided playback clock when video asset is offline or still loading
  useEffect(() => {
    if (!isPlaying) return;
    const videoEl = videoRef.current;
    const usingNativeVideo = Boolean(videoEl && !videoLoadFailed && videoEl.readyState >= 2);
    if (usingNativeVideo) return;

    const tickMs = 200;
    const timerId = window.setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + (tickMs / 1000) * playbackRate;
        const maxDur = duration > 0 ? duration : 20;
        if (next >= maxDur) {
          if (isLooping) {
            return 0;
          }
          setIsPlaying(false);
          return maxDur;
        }
        return next;
      });
    }, tickMs);

    return () => window.clearInterval(timerId);
  }, [isPlaying, playbackRate, isLooping, duration, videoLoadFailed]);

  const handleTogglePlay = async () => {
    const videoEl = videoRef.current;
    if (isPlaying) {
      if (videoEl && !videoLoadFailed) {
        videoEl.pause();
      }
      setIsPlaying(false);
      return;
    }

    if (videoEl && !videoLoadFailed && safeSrc) {
      try {
        videoEl.muted = isMuted;
        videoEl.playbackRate = playbackRate;
        await videoEl.play();
      } catch {
        // Fallback to synchronized guided step timer
        setVideoLoadFailed(true);
      }
    }
    setIsPlaying(true);
  };

  const handleJumpToTime = (targetSeconds: number) => {
    const clamped = Math.max(0, Math.min(duration || 20, targetSeconds));
    setCurrentTime(clamped);
    if (videoRef.current && !videoLoadFailed) {
      try {
        videoRef.current.currentTime = clamped;
      } catch {
        // Ignore seek errors before metadata loads
      }
    }
  };

  const handleStepNavigation = (delta: -1 | 1) => {
    if (steps.length === 0) return;
    const curIndex = activeStep
      ? steps.findIndex((s) => s.stepNumber === activeStep.stepNumber)
      : 0;
    const nextIndex = (curIndex + delta + steps.length) % steps.length;
    handleJumpToTime(steps[nextIndex].startSeconds);
  };

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <section
      aria-label={`Accessible Slow-Motion Video Guide: ${media.exerciseName}`}
      data-testid="accessible-video-player"
      data-playback-rate={String(playbackRate)}
      data-muted={String(isMuted)}
      data-loop={String(isLooping)}
      data-captions-enabled={String(captionsEnabled)}
      className={`rounded-2xl border border-sky-400/45 bg-slate-900 p-4 text-slate-100 shadow-lg space-y-3 ${className}`.trim()}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="inline-block rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[0.6875rem] font-extrabold text-emerald-200">
            Slow-Mo Form Guide · {media.readingLevel}
          </span>
          <h3 className="mt-1 text-base font-extrabold leading-snug text-white">
            {media.exerciseName}
          </h3>
          <p className="text-xs leading-relaxed text-slate-300">
            Starts muted at 0.5x speed on loop so you can watch each movement calmly without rushing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[0.6875rem] font-extrabold">
          <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-sky-200">
            {playbackRate}x Speed
          </span>
          <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-slate-200">
            {isMuted ? 'Muted' : 'Sound On'}
          </span>
          <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-emerald-200">
            {isLooping ? 'Loop On' : 'Loop Off'}
          </span>
        </div>
      </div>

      {/* Video Stage + Grade 6-8 Literal Step Overlay + Synchronized WebVTT Caption Overlay */}
      <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
        {/* Top Overlay: Literal Grade 6-8 Step Card */}
        {activeStep && (
          <div
            data-testid="video-literal-step-overlay"
            aria-live="polite"
            className="border-b border-slate-800 bg-slate-950/95 px-3.5 py-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-emerald-300">
                Step {activeStep.stepNumber} of {steps.length}: {activeStep.title}
              </span>
              <span className="text-[0.6875rem] font-bold text-slate-300">
                {formatSecondsClock(currentTime)} / {formatSecondsClock(duration)}
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-white">
              {activeStep.instruction}
            </p>
            <p className="mt-1 text-[0.6875rem] font-bold text-amber-200">
              Safety check: {activeStep.safetyCue}
            </p>
          </div>
        )}

        {/* Video Surface (Native HTML5 <video> with graceful visual fallback stage) */}
        <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center">
          {safeSrc && !videoLoadFailed ? (
            <video
              ref={videoRef}
              src={safeSrc}
              loop={isLooping}
              muted={isMuted}
              playsInline
              preload="metadata"
              aria-label={media.posterAlt || `${media.exerciseName} form demonstration video`}
              onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                el.muted = isMuted;
                el.loop = isLooping;
                el.playbackRate = playbackRate;
                if (Number.isFinite(el.duration) && el.duration > 0) {
                  setDuration(el.duration);
                }
              }}
              onTimeUpdate={(e) => {
                setCurrentTime(e.currentTarget.currentTime);
              }}
              onError={() => {
                setVideoLoadFailed(true);
              }}
              className="h-full w-full object-contain"
            >
              {vttTrackUrl && (
                <track
                  kind="captions"
                  src={vttTrackUrl}
                  srcLang="en"
                  label="English Closed Captions"
                  default={captionsEnabled}
                />
              )}
            </video>
          ) : (
            <div
              role="img"
              aria-label={media.posterAlt}
              className="flex h-full w-full flex-col items-center justify-start gap-2 px-4 pt-3 pb-24 text-center"
            >
              <span className="rounded-md border border-sky-400/35 bg-sky-950/70 px-2.5 py-0.5 text-[0.6875rem] font-extrabold text-sky-200">
                Guided Slow-Mo Phase {activeStep ? activeStep.stepNumber : 1} · {playbackRate}x Speed
              </span>
              <svg
                viewBox="0 0 240 120"
                className="h-24 w-48 text-sky-300"
                aria-hidden="true"
              >
                <line x1="20" y1="104" x2="220" y2="104" stroke="#475569" strokeWidth="3" />
                <rect x="44" y="22" width="152" height="5" rx="2.5" fill="#38bdf8" />
                <rect x="34" y="14" width="12" height="22" rx="3" fill="#10b981" />
                <rect x="194" y="14" width="12" height="22" rx="3" fill="#10b981" />
                <circle cx="120" cy="34" r="10" fill="#f8fafc" />
                <line
                  x1="120"
                  y1="44"
                  x2="120"
                  y2={activeStep && activeStep.stepNumber === 4 ? '78' : '70'}
                  stroke="#f8fafc"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <line
                  x1="120"
                  y1={activeStep && activeStep.stepNumber === 4 ? '78' : '70'}
                  x2="96"
                  y2="102"
                  stroke="#e2e8f0"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <line
                  x1="120"
                  y1={activeStep && activeStep.stepNumber === 4 ? '78' : '70'}
                  x2="144"
                  y2="102"
                  stroke="#e2e8f0"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}

          {/* Synchronized WebVTT Closed Caption Overlay */}
          {captionsEnabled && activeCaption && (
            <div
              role="region"
              aria-label="Closed Captions"
              data-testid="vtt-caption-overlay"
              className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg border border-slate-500/60 bg-black/90 px-3 py-2 text-center shadow-lg"
            >
              <p className="text-xs font-extrabold leading-relaxed text-white">
                {activeCaption.text}
              </p>
            </div>
          )}
        </div>

        {/* Simple Progress Bar */}
        <div
          role="progressbar"
          aria-label="Video playback progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          className="h-2 w-full bg-slate-800"
        >
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Primary WCAG 2.2 AA Controls (Minimum 48x48px touch targets, clear focus rings) */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Video playback controls">
        <button
          type="button"
          onClick={() => void handleTogglePlay()}
          data-testid="video-play-pause-btn"
          aria-label={isPlaying ? `Pause ${media.exerciseName} video` : `Play ${media.exerciseName} video`}
          className="min-h-[48px] min-w-[48px] flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          {isPlaying ? 'Pause' : 'Play Slow-Mo'}
        </button>

        <button
          type="button"
          onClick={() => handleStepNavigation(-1)}
          data-testid="video-prev-step-btn"
          aria-label="Previous literal step"
          className="min-h-[48px] min-w-[48px] rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          Prev Step
        </button>

        <button
          type="button"
          onClick={() => handleStepNavigation(1)}
          data-testid="video-next-step-btn"
          aria-label="Next literal step"
          className="min-h-[48px] min-w-[48px] rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          Next Step
        </button>
      </div>

      {/* Sensory & Caption Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={isMuted}
          data-testid="video-mute-toggle-btn"
          onClick={() => setIsMuted((prev) => !prev)}
          className="min-h-[48px] min-w-[48px] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs font-extrabold text-slate-100 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          {isMuted ? 'Sound: Muted' : 'Sound: On'}
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={captionsEnabled}
          data-testid="video-captions-toggle-btn"
          onClick={() => setCaptionsEnabled((prev) => !prev)}
          className={`min-h-[48px] min-w-[48px] rounded-xl border px-3 py-2 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
            captionsEnabled
              ? 'border-emerald-400 bg-emerald-600/25 text-emerald-100'
              : 'border-slate-600 bg-slate-950 text-slate-200'
          }`}
        >
          {captionsEnabled ? 'Captions (CC): ON' : 'Captions (CC): OFF'}
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={isLooping}
          data-testid="video-loop-toggle-btn"
          onClick={() => setIsLooping((prev) => !prev)}
          className={`min-h-[48px] min-w-[48px] rounded-xl border px-3 py-2 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
            isLooping
              ? 'border-sky-400 bg-sky-600/25 text-sky-100'
              : 'border-slate-600 bg-slate-950 text-slate-200'
          }`}
        >
          {isLooping ? 'Loop: ON' : 'Loop: OFF'}
        </button>
      </div>

      {/* Playback Speed Selector (Defaults to 0.5x) */}
      <div className="space-y-1.5" role="radiogroup" aria-label="Playback Speed">
        <span className="block text-xs font-bold text-slate-300">Playback Speed</span>
        <div className="grid grid-cols-3 gap-2">
          {ALLOWED_PLAYBACK_RATES.map((rate) => {
            const active = playbackRate === rate;
            return (
              <button
                key={rate}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`video-speed-${rate}`}
                onClick={() => setPlaybackRate(rate)}
                className={`min-h-[48px] min-w-[48px] rounded-xl border px-3 py-2 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                  active
                    ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                    : 'border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {rate === 0.5 ? '0.5x Slow' : rate === 0.75 ? '0.75x Medium' : '1x Normal'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Single-Tap Grade 6-8 Literal Step List */}
      <div className="space-y-2 pt-1">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
          Step-by-Step Guide (Tap Any Step to Jump)
        </h4>
        <ol className="space-y-2">
          {steps.map((step) => {
            const isCurrent = activeStep?.stepNumber === step.stepNumber;
            return (
              <li key={step.stepNumber}>
                <button
                  type="button"
                  onClick={() => handleJumpToTime(step.startSeconds)}
                  aria-current={isCurrent ? 'step' : undefined}
                  data-testid={`video-step-btn-${step.stepNumber}`}
                  className={`min-h-[48px] w-full rounded-xl border px-3.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                    isCurrent
                      ? 'border-emerald-400 bg-emerald-950/50 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-emerald-300">
                      {step.stepNumber}. {step.title}
                    </span>
                    <span className="text-[0.6875rem] font-bold text-slate-400">
                      {formatSecondsClock(step.startSeconds)} – {formatSecondsClock(step.endSeconds)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-200">
                    {step.instruction}
                  </p>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Full Script / Transcript Disclosure */}
      <div className="border-t border-slate-800 pt-2">
        <button
          type="button"
          aria-expanded={showFullScript}
          onClick={() => setShowFullScript((prev) => !prev)}
          className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-left text-xs font-extrabold text-sky-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          {showFullScript ? 'Hide Full Text Script' : 'Read Full Text Script (Transcript)'}
        </button>
        {showFullScript && (
          <div className="mt-2 space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-200">
            {media.script.map((beat, idx) => (
              <p key={idx}>
                <strong className="text-emerald-300">
                  [{formatSecondsClock(beat.startSeconds)}] {beat.speaker}:
                </strong>{' '}
                {beat.text}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default AccessibleVideoPlayer;
