import barbellSquatMediaRaw from '../data/barbellSquatMedia.json';

export type AllowedPlaybackRate = 0.5 | 0.75 | 1;

export interface VideoScriptBeat {
  startSeconds: number;
  endSeconds: number;
  speaker: string;
  text: string;
}

export interface LiteralExerciseStep {
  stepNumber: number;
  title: string;
  instruction: string;
  safetyCue: string;
  startSeconds: number;
  endSeconds: number;
}

export interface VttCaptionCue {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface AccessibleVideoDefaultSettings {
  loop: boolean;
  muted: boolean;
  playbackRate: AllowedPlaybackRate;
  captionsEnabled: boolean;
}

export interface AccessibleExerciseMediaItem {
  id: string;
  exerciseName: string;
  category: string;
  equipment: string;
  readingLevel: string;
  durationSeconds: number;
  videoUrl: string;
  posterAlt: string;
  defaultSettings: AccessibleVideoDefaultSettings;
  script: VideoScriptBeat[];
  vttCaptions: string;
  literalSteps: LiteralExerciseStep[];
}

export const DEFAULT_ACCESSIBLE_VIDEO_SETTINGS: AccessibleVideoDefaultSettings = {
  loop: true,
  muted: true,
  playbackRate: 0.5,
  captionsEnabled: true
};

export const ALLOWED_PLAYBACK_RATES: readonly AllowedPlaybackRate[] = [0.5, 0.75, 1];

export const BARBELL_SQUAT_MEDIA_SAMPLES: AccessibleExerciseMediaItem[] =
  barbellSquatMediaRaw as AccessibleExerciseMediaItem[];

/**
 * Validates media URLs before placing them in `<video src>` to block javascript:/vbscript:/unsafe data: schemes.
 */
export function sanitizeMediaUrl(rawUrl?: string | null): string {
  const clean = String(rawUrl || '').trim();
  if (!clean) return '';
  if (clean.startsWith('/') && !clean.startsWith('//')) {
    return clean;
  }
  try {
    const parsed = new URL(clean);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'blob:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Parses a WebVTT timestamp (`MM:SS.mmm` or `HH:MM:SS.mmm`) into seconds.
 */
export function parseVttTimestampToSeconds(rawTimestamp: string): number {
  const clean = String(rawTimestamp || '').trim().replace(',', '.');
  if (!clean) return NaN;
  const parts = clean.split(':');
  if (parts.length !== 2 && parts.length !== 3) return NaN;

  const numbers = parts.map((p) => Number(p));
  if (numbers.some((n) => !Number.isFinite(n) || n < 0)) return NaN;

  if (numbers.length === 3) {
    const [hours, minutes, seconds] = numbers;
    return hours * 3600 + minutes * 60 + seconds;
  }
  const [minutes, seconds] = numbers;
  return minutes * 60 + seconds;
}

/**
 * Strips any HTML or WebVTT inline formatting tags (`<c>`, `<b>`, `<script>`) safely into plain text.
 */
export function stripVttCueTagsToPlainText(rawCueText: string): string {
  return String(rawCueText || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\r/g, '')
    .trim();
}

/**
 * Parses a `.vtt` (WebVTT) closed caption string into synchronized cue objects.
 */
export function parseWebVttCaptions(vttText: string): VttCaptionCue[] {
  const normalized = String(vttText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.trim()) return [];

  const blocks = normalized.split(/\n{2,}/);
  const cues: VttCaptionCue[] = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const lines = blocks[i]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) continue;
    const firstUpper = lines[0].toUpperCase();
    if (firstUpper.startsWith('WEBVTT') || firstUpper.startsWith('NOTE') || firstUpper.startsWith('STYLE')) {
      continue;
    }

    let timingLineIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingLineIndex === -1) continue;

    const timingLine = lines[timingLineIndex];
    const [rawStart, rawEndWithSettings] = timingLine.split('-->');
    if (!rawStart || !rawEndWithSettings) continue;

    const rawEnd = rawEndWithSettings.trim().split(/\s+/)[0];
    const startSeconds = parseVttTimestampToSeconds(rawStart);
    const endSeconds = parseVttTimestampToSeconds(rawEnd);
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
      continue;
    }

    const id = timingLineIndex > 0 ? lines[timingLineIndex - 1] : `cue-${cues.length + 1}`;
    const textLines = lines.slice(timingLineIndex + 1);
    const text = stripVttCueTagsToPlainText(textLines.join(' '));
    if (!text) continue;

    cues.push({
      id,
      startSeconds,
      endSeconds,
      text
    });
  }

  return cues.sort((a, b) => a.startSeconds - b.startSeconds);
}

/**
 * Returns the active WebVTT closed caption cue at `currentTimeSeconds` (or null if none).
 */
export function getActiveVttCaptionAtTime(
  cues: readonly VttCaptionCue[],
  currentTimeSeconds: number
): VttCaptionCue | null {
  if (!Array.isArray(cues) || cues.length === 0) return null;
  const t = Math.max(0, Number(currentTimeSeconds) || 0);
  const exact = cues.find((cue) => t >= cue.startSeconds && t < cue.endSeconds);
  if (exact) return exact;
  // At exact final timestamp boundary, show the final cue cleanly
  const last = cues[cues.length - 1];
  if (last && Math.abs(t - last.endSeconds) <= 0.15) {
    return last;
  }
  return null;
}

/**
 * Returns the active Grade 6-8 literal exercise step at `currentTimeSeconds`.
 */
export function getActiveLiteralStepAtTime(
  steps: readonly LiteralExerciseStep[],
  currentTimeSeconds: number
): LiteralExerciseStep | null {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const t = Math.max(0, Number(currentTimeSeconds) || 0);
  const exact = steps.find((step) => t >= step.startSeconds && t < step.endSeconds);
  if (exact) return exact;
  if (t >= steps[steps.length - 1].startSeconds) {
    return steps[steps.length - 1];
  }
  return steps[0];
}

export function formatSecondsClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
