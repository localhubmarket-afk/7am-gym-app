/**
 * PWA Rest Timer Alerts (Web Notification API + Vibration API)
 *
 * Automatically dispatches lock-screen visual alerts and haptic feedback when
 * a rest timer finishes, while strictly respecting Sensory-Calm Mode (globally
 * muting all audio chimes and haptic vibrations when isSensoryCalm is true).
 */

export interface RestTimerAlertOptions {
  title?: string;
  body: string;
  tag?: string;
  iconUrl?: string;
  isSensoryCalm?: boolean;
  vibratePattern?: number[];
  /** Injectable test/environment hooks */
  navigatorRef?: Partial<Navigator> | null;
  notificationCtor?: typeof Notification | null;
}

export interface RestTimerAlertResult {
  notifiedViaServiceWorker: boolean;
  notifiedViaWindow: boolean;
  vibrated: boolean;
  mutedBySensoryCalm: boolean;
}

export function shouldMuteSensoryOutput(isSensoryCalm?: boolean): boolean {
  if (typeof isSensoryCalm === 'boolean') return isSensoryCalm;
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      return (
        document.documentElement.classList.contains('sensory-calm') ||
        document.documentElement.getAttribute('data-sensory-calm') === 'true'
      );
    }
  } catch {
    // Ignore SSR/non-DOM environments
  }
  return false;
}

export function triggerSafeHapticFeedback(
  pattern: number | number[] = [250, 120, 250],
  options?: { isSensoryCalm?: boolean; navigatorRef?: Partial<Navigator> | null }
): boolean {
  if (shouldMuteSensoryOutput(options?.isSensoryCalm)) {
    return false;
  }
  const nav = options?.navigatorRef ?? (typeof navigator !== 'undefined' ? navigator : null);
  if (nav && typeof nav.vibrate === 'function') {
    try {
      nav.vibrate(pattern);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function dispatchRestTimerCompletionAlert(
  options: RestTimerAlertOptions
): Promise<RestTimerAlertResult> {
  const mutedBySensoryCalm = shouldMuteSensoryOutput(options.isSensoryCalm);
  const title = options.title || 'Rest Complete — Next Set Ready';
  const body = options.body || 'Your rest timer is done. Start your next set whenever you are ready.';
  const tag = options.tag || 'budget-gym-rest-timer';
  const iconUrl = options.iconUrl || '/icon-192.png';
  const pattern = options.vibratePattern || [300, 140, 300];

  const vibrated = mutedBySensoryCalm
    ? false
    : triggerSafeHapticFeedback(pattern, {
        isSensoryCalm: false,
        navigatorRef: options.navigatorRef
      });

  const nav = options.navigatorRef ?? (typeof navigator !== 'undefined' ? navigator : null);
  const NotifApi =
    options.notificationCtor !== undefined
      ? options.notificationCtor
      : typeof window !== 'undefined' && 'Notification' in window
        ? window.Notification
        : null;

  let notifiedViaServiceWorker = false;
  let notifiedViaWindow = false;

  if (NotifApi && NotifApi.permission === 'granted') {
    const notifOptions: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
      body,
      icon: iconUrl,
      badge: iconUrl,
      tag,
      renotify: true,
      silent: mutedBySensoryCalm,
      ...(mutedBySensoryCalm ? {} : { vibrate: pattern })
    };

    if (nav && 'serviceWorker' in nav && nav.serviceWorker && typeof nav.serviceWorker.getRegistration === 'function') {
      try {
        const reg = await nav.serviceWorker.getRegistration();
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, notifOptions);
          notifiedViaServiceWorker = true;
        }
      } catch {
        notifiedViaServiceWorker = false;
      }
    }

    if (!notifiedViaServiceWorker) {
      try {
        new NotifApi(title, notifOptions);
        notifiedViaWindow = true;
      } catch {
        notifiedViaWindow = false;
      }
    }
  }

  return {
    notifiedViaServiceWorker,
    notifiedViaWindow,
    vibrated,
    mutedBySensoryCalm
  };
}
