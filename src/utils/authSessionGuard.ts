/**
 * Task 1: Unintended Login Trigger Prevention & Non-Auth Input Isolation
 * - Stops mobile OS password managers (iCloud Keychain, Google Password Manager,
 *   1Password, Bitwarden) and WebAuthn Conditional UI from mistaking workout notes,
 *   seat/pin settings, or timer controls for login fields.
 * - Enforces a strict auth-prompt policy: routine workout actions NEVER trigger
 *   a login modal. Login is ONLY allowed on explicit user intent or explicit token expiry.
 */

export type AppActionType =
  | 'initial_cold_load'
  | 'explicit_user_login_click'
  | 'auth_token_expired'
  | 'note_focus'
  | 'note_change'
  | 'next_week_note_change'
  | 'timer_start'
  | 'timer_pause'
  | 'timer_adjust'
  | 'set_log'
  | 'warmup_toggle'
  | 'background_resume'
  | 'program_upload';

export interface LoginPromptDecisionInput {
  action: AppActionType;
  hasActiveUser?: boolean;
  tokenExplicitlyExpired?: boolean;
  requireLoginOnColdLoad?: boolean;
}

export interface LoginPromptDecision {
  shouldPromptLogin: boolean;
  reason: string;
}

export const NON_AUTH_INPUT_ATTRIBUTES: Readonly<Record<string, string>> = Object.freeze({
  autocomplete: 'off',
  autocorrect: 'on',
  spellcheck: 'true',
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
  'data-non-auth-input': 'true'
});

export const AUTH_INPUT_IDS: ReadonlySet<string> = new Set([
  'passwordless-email-input',
  'magic-link-otp-input',
  'lead-name-input',
  'lead-email-input',
  'lead-password-input'
]);

const ROUTINE_NON_AUTH_ACTIONS: ReadonlySet<AppActionType> = new Set([
  'note_focus',
  'note_change',
  'next_week_note_change',
  'timer_start',
  'timer_pause',
  'timer_adjust',
  'set_log',
  'warmup_toggle',
  'background_resume',
  'program_upload'
]);

/**
 * Strict guard controlling when the app may open a login prompt.
 * Routine workout actions (typing notes, pausing a timer, logging sets,
 * resuming from background) NEVER trigger a login prompt.
 */
export function shouldPromptForLogin(input: LoginPromptDecisionInput): LoginPromptDecision {
  if (ROUTINE_NON_AUTH_ACTIONS.has(input.action)) {
    return {
      shouldPromptLogin: false,
      reason: `Blocked unintended login prompt during routine action: ${input.action}.`
    };
  }

  if (input.action === 'explicit_user_login_click') {
    return {
      shouldPromptLogin: true,
      reason: 'User explicitly tapped a login or account switch button.'
    };
  }

  if (input.action === 'auth_token_expired' || input.tokenExplicitlyExpired === true) {
    return {
      shouldPromptLogin: true,
      reason: 'Authentication token has explicitly expired.'
    };
  }

  if (input.action === 'initial_cold_load' && input.requireLoginOnColdLoad === true && !input.hasActiveUser) {
    return {
      shouldPromptLogin: true,
      reason: 'Initial cold load requires sign-in.'
    };
  }

  return {
    shouldPromptLogin: false,
    reason: 'Local workout session remains active without login interruption.'
  };
}

/**
 * Checks whether a DOM input/textarea is an authentication field.
 */
export function isAuthFieldElement(el: Element | null | undefined): boolean {
  if (!el) return false;
  const id = String(el.getAttribute('id') || '').trim();
  if (id && AUTH_INPUT_IDS.has(id)) return true;

  const typeAttr = String(el.getAttribute('type') || '').toLowerCase();
  if (typeAttr === 'password') return true;

  const ac = String(el.getAttribute('autocomplete') || '').toLowerCase();
  if (
    ac.includes('password') ||
    ac.includes('username') ||
    ac.includes('webauthn') ||
    ac.includes('one-time-code')
  ) {
    return true;
  }

  if (typeof (el as HTMLElement).closest === 'function') {
    if ((el as HTMLElement).closest('#new-account-form-wrap, [data-auth-form="true"]')) {
      return true;
    }
  }
  return false;
}

/**
 * Applies strict non-auth attributes to a single workout/note/search input
 * so iOS Safari, Android Chrome, and password managers never pop up login sheets.
 */
export function applyNonAuthInputAttributes(el: Element | null | undefined): boolean {
  if (!el || isAuthFieldElement(el)) return false;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag !== 'input' && tag !== 'textarea') return false;

  const typeAttr = String(el.getAttribute('type') || 'text').toLowerCase();
  if (['hidden', 'checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'range', 'color'].includes(typeAttr)) {
    return false;
  }

  // Use 'off' for standard text/number inputs; 'one-time-code' is never used on non-auth fields.
  el.setAttribute('autocomplete', 'off');
  el.setAttribute('data-lpignore', 'true');
  el.setAttribute('data-1p-ignore', 'true');
  el.setAttribute('data-bwignore', 'true');
  el.setAttribute('data-form-type', 'other');
  el.setAttribute('data-non-auth-input', 'true');

  // Ensure non-auth inputs never carry a name/aria-autocomplete that triggers credential heuristics
  const currentName = String(el.getAttribute('name') || '').trim();
  if (!currentName || /user|email|pass|login|pin|code|auth/i.test(currentName)) {
    const safeId = String(el.getAttribute('id') || 'workout_field').replace(/[^a-zA-Z0-9_-]/g, '_');
    el.setAttribute('name', `gym_nonauth_${safeId}`);
  }

  return true;
}

/**
 * Audits and hardens every non-auth input and textarea inside a root container.
 */
export function enforceNonAuthInputsAcrossRoot(root: ParentNode | null | undefined): number {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  let updated = 0;
  const nodes = root.querySelectorAll('input, textarea');
  nodes.forEach((node) => {
    if (applyNonAuthInputAttributes(node)) {
      updated += 1;
    }
  });
  return updated;
}

/**
 * Disables auth modal inputs while the login modal is hidden so mobile browsers
 * (iOS Safari WebAuthn Conditional UI & Android Chrome Autofill) cannot see hidden
 * email/password inputs in the same document when the user taps a workout note field.
 */
export function syncHiddenAuthModalInputIsolation(modalEl: Element | null | undefined): {
  isHidden: boolean;
  affectedInputs: number;
} {
  if (!modalEl || typeof modalEl.querySelectorAll !== 'function') {
    return { isHidden: true, affectedInputs: 0 };
  }

  const isHidden =
    modalEl.classList.contains('hidden') ||
    modalEl.getAttribute('aria-hidden') === 'true';

  let affectedInputs = 0;
  const authInputs = modalEl.querySelectorAll(
    '#passwordless-email-input, #magic-link-otp-input, #lead-name-input, #lead-email-input, #lead-password-input'
  );

  authInputs.forEach((node) => {
    const input = node as HTMLInputElement;
    if (isHidden) {
      input.disabled = true;
      input.setAttribute('tabindex', '-1');
      input.setAttribute('data-isolated-while-hidden', 'true');
    } else {
      input.disabled = false;
      input.removeAttribute('tabindex');
      input.removeAttribute('data-isolated-while-hidden');
    }
    affectedInputs += 1;
  });

  return { isHidden, affectedInputs };
}

export interface NonAuthNoteInputProps {
  name: string;
  autoComplete: 'off';
  autoCorrect: 'on';
  spellCheck: boolean;
  inputMode: 'text';
  'data-lpignore': 'true';
  'data-1p-ignore': 'true';
  'data-bwignore': 'true';
  'data-form-type': 'other';
  'data-non-auth-input': 'true';
}

/**
 * Generates safe React attributes for workout note and journal inputs so mobile OS
 * keyboards (iOS Keychain, Android Autofill) and password managers never mistake a
 * workout note field for a username or password field.
 */
export function buildNonAuthNoteInputProps(fieldKey: string): NonAuthNoteInputProps {
  const sanitizedKey = String(fieldKey || 'workout_note')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/(user|email|pass|login|pin|code|auth)/gi, 'note');
  return {
    name: `gym_nonauth_${sanitizedKey}`,
    autoComplete: 'off',
    autoCorrect: 'on',
    spellCheck: true,
    inputMode: 'text',
    'data-lpignore': 'true',
    'data-1p-ignore': 'true',
    'data-bwignore': 'true',
    'data-form-type': 'other',
    'data-non-auth-input': 'true'
  };
}

/**
 * Safe focus handler helper for workout note fields:
 * - Hardens the focused element with non-auth attributes
 * - Keeps hidden auth modal inputs disabled so mobile OS Autofill ignores them
 * - Confirms via `shouldPromptForLogin` that note focus NEVER opens a login prompt
 */
export function guardNonAuthNoteFocusEvent(
  target: Element | null | undefined,
  doc: Document | null = typeof document !== 'undefined' ? document : null
): LoginPromptDecision {
  if (target) {
    applyNonAuthInputAttributes(target);
  }
  if (doc) {
    const loginModal = doc.getElementById('smart-login-modal');
    if (loginModal) {
      syncHiddenAuthModalInputIsolation(loginModal);
    }
  }
  return shouldPromptForLogin({ action: 'note_focus' });
}
