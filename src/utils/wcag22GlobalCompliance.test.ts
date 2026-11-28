import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { DEFAULT_DYSLEXIA_FRIENDLY_FONT_STACK } from './themeProvider';
import {
  WCAG_22_AA_THRESHOLDS,
  evaluateWcag22ThemeCompliance
} from './wcag22GlobalCompliance';

const ROOT = process.cwd();
const HTML_PATH = path.resolve(ROOT, 'index.html');
const CSS_PATH = path.resolve(ROOT, 'src/styles/accessibility.css');
const COMPONENTS_DIR = path.resolve(ROOT, 'src/components');

const html = fs.readFileSync(HTML_PATH, 'utf8');
const css = fs.readFileSync(CSS_PATH, 'utf8');
const componentFiles = fs
  .readdirSync(COMPONENTS_DIR)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => ({
    name,
    content: fs.readFileSync(path.join(COMPONENTS_DIR, name), 'utf8')
  }));

test('Pillar 1 (WCAG 1.4.3 & 1.4.11): Dark & Light mode text (>=4.5:1), UI borders (>=3.0:1), placeholders, and disabled states pass', () => {
  for (const mode of ['dark', 'light'] as const) {
    const report = evaluateWcag22ThemeCompliance(mode);
    for (const check of report.checks) {
      assert.ok(
        check.passes,
        `${check.label} failed: got ${check.ratio}:1, required >= ${check.required}:1`
      );
    }
    assert.equal(report.allPassing, true);
  }

  // Zero low-contrast slate-500/600/700 placeholders remain in HTML or React components
  assert.doesNotMatch(html, /placeholder-(slate|gray)-(500|600|700)/i);
  for (const comp of componentFiles) {
    assert.doesNotMatch(
      comp.content,
      /placeholder-(slate|gray|zinc)-(500|600|700)/i,
      `${comp.name} must not use low-contrast placeholder utilities`
    );
  }
});

test('Pillar 2 (WCAG 2.5.8): Zero sub-44px interactive button/label targets and >=8px (0.5rem) spacing enforced', () => {
  assert.equal(WCAG_22_AA_THRESHOLDS.minTouchTargetPx, 44);
  assert.match(css, /--touch-target-min:\s*48px/);
  assert.match(css, /--touch-target-gap:\s*0\.5rem/);

  assert.doesNotMatch(
    html,
    /min-height:\s*(1|2|3\d|4[0-3])px|min-width:\s*(1|2|3\d|4[0-3])px|min-h-\[(1|2|3\d|4[0-3])px\]|min-w-\[(1|2|3\d|4[0-3])px\]/i
  );

  for (const comp of componentFiles) {
    assert.doesNotMatch(
      comp.content,
      /min-h-\[(1|2|3\d|4[0-3])px\]|min-w-\[(1|2|3\d|4[0-3])px\]/i,
      `${comp.name} must enforce >= 44x44px minimum target sizes`
    );
  }
});

test('Pillar 3 (WCAG 2.4.11 & 2.4.13): Dual-halo high-contrast focus indicator, skip link, and focus-not-obscured guard exist', () => {
  assert.match(css, /outline:\s*3px solid #FACC15 !important/);
  assert.match(css, /outline:\s*3px solid #0E1A40 !important/);
  assert.match(css, /scroll-padding-top:/);
  assert.match(css, /scroll-margin-top:/);
  assert.match(html, /class="skip-to-workout-link"/);
  assert.match(html, /href="#active-day-workout-container"/);
  assert.match(html, /function ensureFocusedElementNotObscured/);
});

test('Pillar 4 (Semantic HTML & Screen Readers): Zero clickable divs/spans, full icon-button aria-labels, and modal dialog roles', () => {
  assert.doesNotMatch(
    html,
    /<(div|span)\b[^>]*(onclick|role=["']button["']|cursor-pointer|tabindex=["']0["'])/i
  );

  for (const comp of componentFiles) {
    const divSpanTagRegex = /<(div|span)\b[^>]*>/gi;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = divSpanTagRegex.exec(comp.content)) !== null) {
      const tag = tagMatch[0];
      if (/role=["'](dialog|alertdialog)["']/i.test(tag)) continue;
      assert.doesNotMatch(
        tag,
        /(onClick=|role=["']button["']|cursor-pointer)/i,
        `${comp.name} must use semantic <button> tags instead of clickable divs/spans: ${tag}`
      );
    }
  }

  // Every icon/symbol button in index.html must carry aria-label or aria-labelledby
  const buttonRegex = /<button\b([\s\S]*?)>([\s\S]*?)<\/button>/gi;
  let match: RegExpExecArray | null;
  while ((match = buttonRegex.exec(html)) !== null) {
    const attrs = match[1];
    const inner = match[2]
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<span[^>]*aria-hidden=["']true["'][^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\$\{[^}]+\}/g, 'DYN')
      .trim();
    const hasAriaLabel = /aria-label=/i.test(attrs) || /aria-labelledby=/i.test(attrs);
    if (inner.length <= 2 || /^[✕×▲▼▾▸←→+−\-★⚙️📷↺✓🔊🔇⏱️🔒💧]+$/.test(inner)) {
      assert.ok(hasAriaLabel, `Icon/compact button missing aria-label: inner="${inner}" attrs="${attrs.trim()}"`);
    }
  }

  // Key modal overlays declare role="dialog" or role="alertdialog" and aria-modal="true"
  for (const modalId of [
    'db-sync-modal',
    'share-store-modal',
    'gym-time-selector-modal',
    'week-schedule-modal',
    'sync-settings-modal',
    'smart-login-modal',
    'gemini-ai-modal',
    'workout-complete-modal',
    'smartwatch-health-modal',
    'camera-ocr-modal'
  ]) {
    const modalTagMatch = html.match(new RegExp(`<div[^>]*id="${modalId}"[^>]*>`, 'i'));
    assert.ok(modalTagMatch, `Expected modal #${modalId} to exist`);
    assert.match(modalTagMatch[0], /role="(dialog|alertdialog)"/);
    assert.match(modalTagMatch[0], /aria-modal="true"/);
  }
});

test('Pillar 5 (Typography & Plain Language): Atkinson Hyperlegible + Lexend stack, >=1rem body text, >=1.5 line-height, zero px font sizes', () => {
  assert.match(DEFAULT_DYSLEXIA_FRIENDLY_FONT_STACK, /^'Atkinson Hyperlegible',\s*'Lexend'/);
  assert.match(css, /font-size:\s*1rem/);
  assert.match(css, /line-height:\s*1\.5\s*!important/);
  assert.doesNotMatch(css, /font-size:\s*[0-9.]+px/i);
  assert.doesNotMatch(html, /font-size:\s*[0-9.]+px/i);
});

test('Pillar 6 & 7 (3-Phase Chronological Layout, 390px Mobile Reflow & Sticky Ergonomics + Zero Feature Deletion)', () => {
  const phase1Pos = html.indexOf('id="day-management-interception-panel"');
  const phase2Pos = html.indexOf('id="warmup-card-container"');
  const lockerPos = html.indexOf('id="warmup-locker-checklist-slot"');
  const phase3Pos = html.indexOf('id="active-day-workout-container"');
  const bannerPos = html.indexOf('id="day-banner"');
  const stickyHudPos = html.indexOf('id="sticky-active-day-hud"');
  const waterPos = html.indexOf('id="gym-zone-c-tracker-slot"');
  const pullupPos = html.indexOf('id="pinned-pullups-gym-hub"');
  const exListPos = html.indexOf('id="exercise-list"');

  assert.ok(phase1Pos > 0 && phase1Pos < phase2Pos, 'Phase 1 must sit above Phase 2');
  assert.ok(phase2Pos < lockerPos && lockerPos < phase3Pos, 'Locker checklist must sit inside Phase 2 before Phase 3');
  assert.ok(phase3Pos < bannerPos && bannerPos < stickyHudPos, 'Sticky active-day HUD must sit inside Phase 3 below day-banner');
  assert.ok(stickyHudPos < waterPos && waterPos < pullupPos && pullupPos < exListPos, 'Phase 3 chronological order must keep Water -> Pull-Ups -> Exercises');

  // 390px mobile day selector grid (4-col on narrow mobile, 7-col on >=640px) + thumb-stacked set controls
  assert.match(css, /grid-template-columns:\s*repeat\(4,\s*minmax\(44px,\s*1fr\)\)\s*!important/);
  assert.match(css, /\.sticky-active-day-hud\s*\{[\s\S]*?position:\s*sticky/);

  // Zero Feature Deletion assertions
  assert.match(html, /function computeBarbellMath/);
  assert.match(html, /hydrateGymStateLocalFirst/);
  assert.match(html, /id="force-pull-cloud-btn"/);
  assert.match(html, /id="pinned-rest-timer-row"/);
  assert.match(html, /id="view-vegan"/);
  assert.match(html, /id="view-shopping"/);
});
