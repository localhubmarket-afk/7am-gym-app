# Pre-Production Deployment Checklist

- Complete every item below before pushing any new feature or workout plan to production.

## 1. Automated QA Checks

- [ ] Run the automated QA content scanner (`node scripts/qa-content-scan.mjs`).
- [ ] Confirm zero broken links or placeholder URLs exist in the app.
- [ ] Confirm zero spelling mistakes exist in buttons, pop-ups, or exercise notes.
- [ ] Confirm zero database words appear in user-facing screens or pop-ups.
- [ ] Run all unit tests (`npx tsx --test src/utils/workoutLogic.test.ts`) and confirm 100% pass.
- [ ] Run the production build (`npm run build`) and code linter (`npm run lint`) with zero errors.

## 2. Certified Fitness Expert Review

- [ ] Assign every new workout plan to a certified fitness professional (`CSCS`, `NASM-CPT`, `ACE-CPT`, `ACSM-CPT`, or `CSEP-CPT`).
- [ ] Verify the reviewer holds an active, unexpired certification license ID.
- [ ] Confirm the reviewer signs off with `status: "approved"` and a valid approval date.
- [ ] Block deployment if any new exercise or program lacks written expert approval.

## 3. Sports Science Alignment

- [ ] Verify all rest timer suggestions stay between 30 seconds and 300 seconds.
- [ ] Verify weekly hard sets per muscle group stay between 4 and 24 sets.
- [ ] Verify effort targets (RPE) stay between 5 and 10.
- [ ] Verify daily protein goals stay between 1.2 and 2.6 grams per kilogram of body weight.
- [ ] Verify daily water targets stay between 1,500 ml and 5,000 ml.
- [ ] Confirm every workout day starts with a warm-up block.
- [ ] Confirm zero unsafe or unproven fitness claims appear in workout or meal copy.

## 4. Account Deletion & Data Sanitization

- [ ] Confirm the deletion pop-up reads: `"This will permanently erase your account and all your data. You cannot get it back."`
- [ ] Confirm the deletion pop-up keeps only `"Cancel"` and `"Yes, Delete Account"` buttons.
- [ ] Confirm account deletion runs Server, Mobile Storage/Cache, and Web Cookie cleanup at the same time.
- [ ] Confirm deleting an account clears all browser session cookies to stop ghost logins.
- [ ] Confirm deleting an account checks for another saved profile on the device.
- [ ] Confirm the one-click switch pop-up reads: `"Account deleted. Do you want to continue as [Other Account Name]?"`
- [ ] Confirm the empty login screen appears only when no other saved account exists on the device.

## 5. Accessibility & Plain English (WCAG 2.1 AA / ELI12)

- [ ] Keep all user text short, simple, and easy to read (Grade 6 / ELI12 reading level).
- [ ] Check text contrast is at least 4.5:1 on both dark and light elements.
- [ ] Confirm all modals use `role="dialog"`, `aria-modal="true"`, and clear headings.
- [ ] Test layout on mobile (`390px` wide) and desktop (`1280px` wide) with zero side scrolling.

## 6. Zero Feature Deprecation

- [ ] Confirm `"Fresh Start Reset"` still works inside the Account tab.
- [ ] Confirm `"Switch Account / Log Out"` still works inside the Account tab.
- [ ] Confirm the 4-tab menu (`1. Dashboard`, `2. Body & Photos`, `3. Gear`, `4. Account`) stays intact.
- [ ] Confirm `"Reset Workout"`, `"Reset Fuel"`, the 1RM D3 chart, locker pin, and Undo safety net all stay intact.
