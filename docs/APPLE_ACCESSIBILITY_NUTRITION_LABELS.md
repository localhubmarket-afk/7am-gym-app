# Apple App Store Accessibility Nutrition Labels Checklist

This checklist maps the **9 official Apple App Store Accessibility Nutrition Labels** to verified features in the **7AM Budget Gym & Vegan Muscle Hub** codebase (Phase 1 Neurodivergent Accessibility Blueprint).

> **Summary**: **8 of 9** labels are ready for App Store Connect declaration today; **Audio Descriptions** currently provides a synchronized Grade 6–8 literal text & transcript alternative and awaits Phase 2 narrated audio tracks before checking the Apple label.

| # | Apple Accessibility Nutrition Label | App Support | Verified Implementation in Codebase |
| :-: | :--- | :---: | :--- |
| 1 | **VoiceOver** | ✅ Supported | Semantic HTML landmarks, native `<button>`/`<input>`/`<label>` controls, `role="switch"`/`role="dialog"`/`role="radiogroup"`, descriptive `aria-label` names, and `aria-live="polite"` status toasts across Auth, Workout, Settings, and Video Player. |
| 2 | **Voice Control** | ✅ Supported | Visible button labels match accessible names (WCAG 2.5.3 Label in Name), minimum `44×44px–48×48px` touch targets, and single-tap button alternatives (`Prev Step`/`Next Step`, `Prev Point`/`Next Point`) for all drag/scrub interactions. |
| 3 | **Larger Text** | ✅ Supported | 100% relative `rem` typography (`src/styles/accessibility.css`), responsive `flex-wrap` reflow tested at `390×844` up to 200% zoom, plus OpenDyslexic / Lexend / Atkinson font scaling and Dyslexia-friendly spacing. |
| 4 | **Dark Interface** | ✅ Supported | High-contrast Dark Mode (`#1A1A1A` / `#F2F2F2`), Light Mode (`#F7F7F7` / `#0A1128`), and System theme auto-detection (`src/utils/themeProvider.ts`). |
| 5 | **Differentiate Without Color Alone** | ✅ Supported | Every status (completed sets, `ON`/`OFF` toggles, Adherence-Neutral 30-day score, Visual Plate Loader weights, validation errors) combines color with explicit text labels and symbols; verified legible under Sensory-Calm Mode (`<5%` saturation). |
| 6 | **Sufficient Contrast** | ✅ Supported | Automated WCAG 2.2 AA contrast ratio checks (`calculateWcagContrastRatio`) verify `>= 4.5:1` text contrast and `>= 3:1` UI component contrast, including high-contrast black-backed WebVTT caption overlays. |
| 7 | **Reduced Motion** | ✅ Supported | Global Sensory-Calm Mode + `prefers-reduced-motion` media queries suppress transitions/animations; `withStableViewportScroll` prevents scroll jumps during set logging; `<AccessibleVideoPlayer>` defaults to `0.5x` slow-motion. |
| 8 | **Captions** | ✅ Supported | `<AccessibleVideoPlayer>` parses and displays synchronized `.vtt` (WebVTT) closed captions by default (`captionsEnabled: true`) alongside native `<track kind="captions">` and expandable full transcripts. |
| 9 | **Audio Descriptions** | 🟡 Planned (Phase 2) | Phase 1 provides synchronized Grade 6–8 literal text steps and visual alt descriptions (`posterAlt`) for muted-by-default demos. Add recorded narrated audio-description tracks before toggling this label in App Store Connect. |
