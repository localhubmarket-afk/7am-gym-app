# Voluntary Product Accessibility Template (VPAT® 2.5 — WCAG 2.2 AA Edition)

## Product Information

- **Name of Product / Version**: 7AM Budget Gym & Vegan Muscle Hub (Beta Web PWA / Mobile Web)
- **Report Date**: November 24, 2026
- **Product Description**: Local-first, cross-device strength training, progressive overload, and budget meal-tracking Progressive Web App designed for WCAG 2.2 AA and W3C COGA neurodivergent accessibility.
- **Contact Information**: Accessibility Compliance Team — `accessibility@7amgym.app`
- **Evaluation Methods Used**: Automated unit tests (`node:test`), keyboard navigation inspection, WCAG 2.2 contrast ratio calculations (`calculateWcagContrastRatio`), mobile viewport verification (`390×844` at 200% zoom reflow), and manual screen-reader / ARIA landmark audits.

## Applicable Standards / Guidelines

This report covers the degree of conformance for the following accessibility standards:

| Standard / Guideline | Included In Report |
| :--- | :--- |
| Web Content Accessibility Guidelines 2.0 | Level A (Yes) · Level AA (Yes) · Level AAA (No) |
| Web Content Accessibility Guidelines 2.1 | Level A (Yes) · Level AA (Yes) · Level AAA (No) |
| Web Content Accessibility Guidelines 2.2 | Level A (Yes) · Level AA (Yes) · Level AAA (No) |

## Conformance Level Definitions

- **Supports**: The functionality of the product has at least one method that meets the criterion without known defects or meets with equivalent facilitation.
- **Partially Supports**: Some functionality of the product does not meet the criterion.
- **Does Not Support**: The majority of product functionality does not meet the criterion.
- **Not Applicable**: The criterion is not relevant to the product.

---

## Table 1: Success Criteria, Level A

| Criteria | Conformance Level | Remarks and Explanations |
| :--- | :--- | :--- |
| **1.1.1 Non-text Content (A)** | Supports | Visual Plate Loader SVGs, D3 strength charts, exercise form illustrations, and icon buttons include descriptive `aria-label` or `alt` text; decorative icons use `aria-hidden="true"`. |
| **1.2.1 Audio-only and Video-only (Prerecorded) (A)** | Supports | `<AccessibleVideoPlayer>` provides a synchronized Grade 6–8 literal step-by-step text guide and expandable full transcript for prerecorded silent/muted exercise demos. |
| **1.2.2 Captions (Prerecorded) (A)** | Supports | `<AccessibleVideoPlayer>` parses and displays synchronized WebVTT (`.vtt`) closed captions by default (`captionsEnabled: true`) alongside native `<track kind="captions">`. |
| **1.2.3 Audio Description or Media Alternative (A)** | Supports | Every exercise video item in the media pipeline includes explicit literal visual descriptions (`literalSteps` + `posterAlt` + full text script). |
| **1.3.1 Info and Relationships (A)** | Supports | Semantic HTML landmarks (`<header>`, `<nav>`, `<main>`, `<section>`, `<ol>`), programmatic `<label for>` bindings, `role="dialog"`, `role="switch"`, and `role="radiogroup"` convey structure. |
| **1.3.2 Meaningful Sequence (A)** | Supports | Reading and focus order follow top-to-bottom workout execution: Day Selector → 2-Minute Micro-Start → Exercise Cards → Set Logging Rows. |
| **1.3.3 Sensory Characteristics (A)** | Supports | Instructions never rely solely on color or shape; all statuses pair text labels (`Done`, `ON`, `Muted`, `0.5x Slow`) with icons and contrast borders. |
| **1.4.1 Use of Color (A)** | Supports | Adherence-Neutral 30-day progress, completed sets, plate weights, and form validation errors always combine color with clear text labels and symbols (`✓`, step numbers, error alerts). |
| **1.4.2 Audio Control (A)** | Supports | `<AccessibleVideoPlayer>` defaults to `muted: true`; Global Sensory-Calm Mode mutes all rest-timer chimes and haptics; rest timer audio provides Sound / Vibe / Silent controls. |
| **2.1.1 Keyboard (A)** | Supports | All workout logging buttons, auth tabs, passwordless controls, D3 chart point navigation (`Prev Point` / `Next Point`), and video controls use native `<button>` and `<input>` elements reachable via keyboard. |
| **2.1.2 No Keyboard Trap (A)** | Supports | Modals include visible Close buttons and never trap keyboard focus. |
| **2.1.4 Character Key Shortcuts (A)** | Supports | No single-character keyboard shortcuts hijack assistive technology keys. |
| **2.2.1 Timing Adjustable (A)** | Supports | Rest timers are user-adjustable (`-15s` / `+15s` / Pause / Skip) and never expire user data or log users out during workouts. |
| **2.2.2 Pause, Stop, Hide (A)** | Supports | Looping slow-motion exercise videos include a 48×48px `Pause` button and `Loop: ON/OFF` switch; Sensory-Calm Mode disables all UI animations. |
| **2.3.1 Three Flashes or Below Threshold (A)** | Supports | No flashing or strobing animations exist; Sensory-Calm Mode suppresses motion globally. |
| **2.4.1 Bypass Blocks (A)** | Supports | Consistent navigation landmarks and focused task views (ADHD-friendly view, 2-Minute Micro-Start) reduce repetitive scanning. |
| **2.4.2 Page Titled (A)** | Supports | Document title (`Gym & Vegan Muscle Hub`) and dialog headings clearly describe purpose. |
| **2.4.3 Focus Order (A)** | Supports | Tab order follows visual layout; logging a set preserves viewport scroll position without unexpected jumps. |
| **2.4.4 Link Purpose (In Context) (A)** | Supports | Action buttons and links use plain ELI12 wording (`Send Magic Link`, `Force Pull from Cloud`, `Export JSON Backup`). |
| **2.5.1 Pointer Gestures (A)** | Supports | All swipe or drag chart interactions have single-tap button alternatives (`Prev Point` / `Next Point`, step jump buttons). |
| **2.5.2 Pointer Cancellation (A)** | Supports | Actions trigger on `click` (up-event) rather than `mousedown`, allowing cancellation. |
| **2.5.3 Label in Name (A)** | Supports | Accessible names (`aria-label`) match or begin with visible button text. |
| **2.5.4 Motion Actuation (A)** | Not Applicable | No shake-to-undo or tilt-only controls are required. |
| **3.1.1 Language of Page (A)** | Supports | `<html lang="en">` is declared on the document root. |
| **3.2.1 On Focus (A)** | Supports | Focusing inputs or buttons never triggers automatic navigation or unexpected context changes. |
| **3.2.2 On Input (A)** | Supports | Toggling preferences updates UI state predictably; set logging maintains strict scroll stability (`withStableViewportScroll`). |
| **3.2.6 Consistent Help (A — WCAG 2.2)** | Supports | Settings, Sync controls, and Accessibility options remain in the same top-level location across views. |
| **3.3.1 Error Identification (A)** | Supports | Form inputs (email, OTP code, logged weight/reps, JSON backup import) announce specific ELI12 errors via `role="alert"`. |
| **3.3.2 Labels or Instructions (A)** | Supports | All inputs include visible labels, format hints (e.g., `you@example.com`), and Grade 6–8 literal instructions. |
| **3.3.7 Redundant Entry (A — WCAG 2.2)** | Supports | User email, unit preference, and logged weights auto-populate across Magic Link, Passkey setup, and subsequent workout sets via deterministic Double Progression. |
| **4.1.2 Name, Role, Value (A)** | Supports | Custom switches use `role="switch"` + `aria-checked`; radio groups use `role="radiogroup"` + `aria-checked`; modals use `role="dialog"` + `aria-modal="true"`. |

---

## Table 2: Success Criteria, Level AA

| Criteria | Conformance Level | Remarks and Explanations |
| :--- | :--- | :--- |
| **1.2.4 Captions (Live) (AA)** | Not Applicable | Application does not broadcast live audio/video streams. |
| **1.2.5 Audio Description (Prerecorded) (AA)** | Partially Supports | Prerecorded exercise guides default to muted playback and include synchronized Grade 6–8 literal text steps and WebVTT captions; spoken audio-description tracks will expand in Phase 2 media production. |
| **1.3.4 Orientation (AA)** | Supports | Layouts adapt cleanly across both portrait mobile (`390×844`) and landscape/desktop viewports without orientation lock. |
| **1.3.5 Identify Input Purpose (AA)** | Supports | Login and profile fields declare standard HTML `autocomplete` attributes (`email`, `given-name`, `one-time-code`, `current-password`, `new-password`). |
| **1.4.3 Contrast (Minimum) (AA)** | Supports | High-contrast Light (`#F7F7F7` / `#0A1128`, >15:1) and Dark (`#1A1A1A` / `#F2F2F2`, >14:1) themes are verified by automated WCAG contrast tests (`>= 4.5:1`). |
| **1.4.4 Resize Text (AA)** | Supports | Typography uses relative `rem` units (Dynamic Type web equivalent) so scaling up to 200% reflows cleanly without clipped text. |
| **1.4.5 Images of Text (AA)** | Supports | All UI copy, plate labels, and captions render as live selectable text rather than rasterized text images. |
| **1.4.10 Reflow (AA)** | Supports | Responsive flex/grid layouts reflow cleanly at `320px–390px` width without horizontal scrolling. |
| **1.4.11 Non-text Contrast (AA)** | Supports | Input borders, toggle boundaries, focus outlines, and chart bars/lines meet `>= 3:1` non-text contrast against adjacent surfaces. |
| **1.4.12 Text Spacing (AA)** | Supports | Dyslexia-Friendly View and OpenDyslexic / Lexend / Atkinson font stacks support increased line height, letter spacing, and word spacing without text overlap or truncation. |
| **1.4.13 Content on Hover or Focus (AA)** | Supports | Tooltips (e.g., D3 chart readouts) are tap/focus-accessible and do not obscure interactive controls. |
| **2.4.5 Multiple Ways (AA)** | Supports | Users navigate via top-level tab navigation, day pills, week jump buttons, and direct exercise step lists. |
| **2.4.6 Headings and Labels (AA)** | Supports | Clear, literal ELI12 headings (`Auto-Sync Devices`, `Data Backup & Migration`, `Fast Passwordless Sign-In`, `Step-by-Step Guide`). |
| **2.4.7 Focus Visible (AA)** | Supports | High-contrast `focus-visible` rings (`2px` sky-300 with offset) appear on all interactive buttons, switches, and inputs. |
| **2.4.11 Focus Not Obscured (Minimum) (AA — WCAG 2.2)** | Supports | Modals scroll within bounded containers (`max-h-[92vh] overflow-y-auto`) and active logging preserves viewport stability so focused fields remain visible. |
| **2.5.7 Dragging Movements (AA — WCAG 2.2)** | Supports | Every chart scrubber and video timeline offers explicit single-tap `Prev` / `Next` and numbered step buttons. |
| **2.5.8 Target Size (Minimum) (AA — WCAG 2.2)** | Supports | Interactive controls exceed the 24×24px WCAG 2.2 minimum and target `>= 44×44px` to `48×48px` with `>= 8px` spacing. |
| **3.1.2 Language of Parts (AA)** | Supports | Content is written in consistent plain English (Grade 6–8 / ELI12 reading level). |
| **3.2.3 Consistent Navigation (AA)** | Supports | Navigation tabs, header actions, and settings controls stay in a consistent order across screens. |
| **3.2.4 Consistent Identification (AA)** | Supports | Recurring controls (`Force Sync Now`, `Force Pull from Cloud`, `Export JSON Backup`, `Pause`) keep identical labels and roles. |
| **3.3.3 Error Suggestion (AA)** | Supports | Validation messages suggest actionable corrections (e.g., `example: alex@gmail.com` or `choose a 7am_gym_backup.json file`). |
| **3.3.4 Error Prevention (Legal, Financial, Data) (AA)** | Supports | Destructive actions (Reset Day, Delete All Weeks, Delete Account) require explicit plain-language confirmation dialogs and offer Undo recovery where applicable. |
| **3.3.8 Accessible Authentication (Minimum) (AA — WCAG 2.2)** | Supports | **Passwordless Login implemented**: Users can sign in with zero password memorization via **Supabase Magic Link (Email OTP)**, **WebAuthn Biometric Passkeys (FaceID / TouchID / Fingerprint)**, Apple Sign-In, or Google Sign-In, while copy/paste and Show/Hide remain supported for password users. |
| **4.1.3 Status Messages (AA)** | Supports | Cloud sync states, Force Pull confirmation toasts, JSON backup status, and caption overlays use `role="status"` or `role="alert"` with `aria-live="polite"`. |

---

## Neurodivergent & Cognitive Accessibility Highlights (W3C COGA Alignment)

- **Adherence-Neutral 30-Day Consistency**: Replaced punitive streak resets with a guilt-free rolling 30-day percentage score and supportive ELI12 messaging.
- **Deterministic Double Progression**: Calculates target weights strictly from objective logged reps/weights; subjective RPE/RIR fields are hidden behind an opt-in Advanced Settings toggle.
- **2-Minute Micro-Start**: Reduces task-initiation paralysis by showing only Warm-Up Set 1 until completed.
- **Sensory-Calm Mode & Special Layouts**: Dedicated toggles for **ADHD-friendly view**, **Dyslexia-friendly view**, **OpenDyslexic font**, and **Sensory-Calm Mode** (`<5%` saturation, animations off, audio/haptics muted).
- **Accessible 0.5x Video Player**: Defaults to muted, looping `0.5x` slow-motion playback with synchronized `.vtt` closed captions and Grade 6–8 literal text steps.
