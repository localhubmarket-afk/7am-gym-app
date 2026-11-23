import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  ACCESSIBLE_THEME_TOKENS,
  DEFAULT_DYSLEXIA_FRIENDLY_FONT_STACK,
  OPENDYSLEXIC_FONT_STACK,
  applyDyslexiaFontToDocument,
  applyThemeToDocument,
  calculateWcagContrastRatio,
  loadStoredFontPreference,
  normalizeFontModePreference,
  saveFontPreference
} from './themeProvider';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    }
  };
}

test('Task 1: Zero absolute px font-size values exist across HTML, CSS, components, and workoutLogic', () => {
  const filesToCheck = [
    path.resolve(process.cwd(), 'index.html'),
    path.resolve(process.cwd(), 'src/styles/accessibility.css'),
    path.resolve(process.cwd(), 'src/utils/workoutLogic.ts'),
    path.resolve(process.cwd(), 'src/d3ChartBridge.ts')
  ];

  const componentsDir = path.resolve(process.cwd(), 'src/components');
  for (const file of fs.readdirSync(componentsDir)) {
    if (file.endsWith('.tsx')) {
      filesToCheck.push(path.join(componentsDir, file));
    }
  }

  for (const filePath of filesToCheck) {
    const content = fs.readFileSync(filePath, 'utf8');
    assert.doesNotMatch(
      content,
      /font-size:\s*[0-9.]+px/i,
      `${path.basename(filePath)} must not use absolute px font-size`
    );
    assert.doesNotMatch(
      content,
      /text-\[[0-9.]+px\]/i,
      `${path.basename(filePath)} must not use Tailwind arbitrary px font-size`
    );
  }
});

test('Task 2: High-contrast dyslexia-friendly Light (#F7F7F7/#0A1128) and Dark (#1A1A1A/#F2F2F2) palettes exceed WCAG AAA contrast', () => {
  assert.equal(ACCESSIBLE_THEME_TOKENS.light.canvasBg, '#F7F7F7');
  assert.equal(ACCESSIBLE_THEME_TOKENS.light.textPrimary, '#0A1128');
  assert.equal(ACCESSIBLE_THEME_TOKENS.dark.canvasBg, '#1A1A1A');
  assert.equal(ACCESSIBLE_THEME_TOKENS.dark.textPrimary, '#F2F2F2');

  const lightContrast = calculateWcagContrastRatio(
    ACCESSIBLE_THEME_TOKENS.light.canvasBg,
    ACCESSIBLE_THEME_TOKENS.light.textPrimary
  );
  const darkContrast = calculateWcagContrastRatio(
    ACCESSIBLE_THEME_TOKENS.dark.canvasBg,
    ACCESSIBLE_THEME_TOKENS.dark.textPrimary
  );

  assert.ok(lightContrast >= 15.8, `Expected light contrast >= 15.8:1, got ${lightContrast}:1`);
  assert.ok(darkContrast >= 15.0, `Expected dark contrast >= 15.0:1, got ${darkContrast}:1`);

  // Verify applyThemeToDocument updates CSS custom properties and data-theme
  const cssVars = new Map<string, string>();
  const attrs = new Map<string, string>();
  const classSet = new Set<string>();
  const mockDoc = {
    documentElement: {
      classList: {
        toggle: (cls: string, force?: boolean) => {
          if (force) classSet.add(cls);
          else classSet.delete(cls);
        }
      },
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      style: {
        setProperty: (k: string, v: string) => cssVars.set(k, v)
      }
    },
    querySelector: () => null
  } as unknown as Document;

  const lightApplied = applyThemeToDocument('light', mockDoc, true);
  assert.equal(lightApplied.resolved, 'light');
  assert.equal(attrs.get('data-theme'), 'light');
  assert.equal(cssVars.get('--bg-canvas'), '#F7F7F7');
  assert.equal(cssVars.get('--text-primary'), '#0A1128');

  const darkApplied = applyThemeToDocument('dark', mockDoc, false);
  assert.equal(darkApplied.resolved, 'dark');
  assert.equal(attrs.get('data-theme'), 'dark');
  assert.equal(cssVars.get('--bg-canvas'), '#1A1A1A');
  assert.equal(cssVars.get('--text-primary'), '#F2F2F2');
});

test('Task 2: Default Lexend/Atkinson font stack, global line-height 1.5, global italic strip, and One-Tap OpenDyslexic toggle', () => {
  assert.match(DEFAULT_DYSLEXIA_FRIENDLY_FONT_STACK, /Lexend/i);
  assert.match(DEFAULT_DYSLEXIA_FRIENDLY_FONT_STACK, /Atkinson Hyperlegible/i);
  assert.match(OPENDYSLEXIC_FONT_STACK, /OpenDyslexic/i);

  assert.equal(normalizeFontModePreference('opendyslexic'), 'opendyslexic');
  assert.equal(normalizeFontModePreference('default'), 'default');
  assert.equal(normalizeFontModePreference('unknown'), 'default');

  const store = createMemoryStorage();
  assert.equal(loadStoredFontPreference(store), 'default');
  saveFontPreference('opendyslexic', store);
  assert.equal(loadStoredFontPreference(store), 'opendyslexic');

  const cssVars = new Map<string, string>();
  const attrs = new Map<string, string>();
  const mockDoc = {
    documentElement: {
      classList: { toggle: () => {} },
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      style: { setProperty: (k: string, v: string) => cssVars.set(k, v) }
    }
  } as unknown as Document;

  const odRes = applyDyslexiaFontToDocument('opendyslexic', mockDoc);
  assert.equal(odRes.mode, 'opendyslexic');
  assert.equal(attrs.get('data-font-mode'), 'opendyslexic');
  assert.match(cssVars.get('--app-font-family') || '', /OpenDyslexic/);

  const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/accessibility.css'), 'utf8');
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

  assert.match(css, /font-style:\s*normal\s*!important/);
  assert.match(html, /font-style:\s*normal\s*!important/);
  assert.match(css, /--app-line-height:\s*1\.5/);
  assert.match(html, /line-height:\s*1\.5\s*!important/);
  assert.match(html, /id="toggle-opendyslexic-font-btn"/);
  assert.match(html, /fonts\.cdnfonts\.com\/css\/open-dyslexic/);
});

test('Task 3: Motor ergonomics enforce 48x48px touch targets, >= 8px gaps, and explicit single-tap alternatives to swipe/drag', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/accessibility.css'), 'utf8');
  const bridge = fs.readFileSync(path.resolve(process.cwd(), 'src/d3ChartBridge.ts'), 'utf8');

  assert.match(html, /min-height:\s*48px/);
  assert.match(html, /min-width:\s*48px/);
  assert.match(css, /--touch-target-min:\s*48px/);
  assert.match(css, /--touch-target-gap:\s*0\.5rem/);

  // Explicit single-tap visible Delete Set trash-can button on set rows
  assert.match(html, /class="delete-set-btn/);
  assert.match(html, /data-delete-set-key=/);

  // Explicit single-tap Previous / Next point navigation buttons on scrubbable D3 1RM chart
  assert.match(bridge, /d3-chart-tap-controls/);
  assert.match(bridge, /Prev Point/);
  assert.match(bridge, /Next Point/);
});

test('Task 4: Fluid orientation removes portrait lock in manifests and supports landscape reflow', () => {
  const publicManifest = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'public/manifest.json'), 'utf8')
  );
  const rootManifest = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'manifest.json'), 'utf8')
  );
  const viteConfig = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');
  const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/accessibility.css'), 'utf8');
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

  assert.equal(publicManifest.orientation, 'any');
  assert.equal(rootManifest.orientation, 'any');
  assert.doesNotMatch(viteConfig, /orientation:\s*['"]portrait['"]/);
  assert.match(css, /@media\s*\(orientation:\s*landscape\)/);
  assert.match(html, /@media\s*\(orientation:\s*landscape\)/);
});
