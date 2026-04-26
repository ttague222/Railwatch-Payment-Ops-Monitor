const PREFS_KEY = 'railwatch_user_prefs';

export interface UserPreferences {
  panelCollapseState: Record<string, boolean>;
  refreshInterval: number; // milliseconds
}

const DEFAULTS: UserPreferences = {
  panelCollapseState: {},
  refreshInterval: 30_000,
};

/**
 * Reads user preferences from LocalStorage.
 * Returns defaults if the key is absent or the stored value fails to parse.
 */
export function readPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      panelCollapseState: parsed.panelCollapseState ?? {},
      refreshInterval: parsed.refreshInterval ?? DEFAULTS.refreshInterval,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Writes user preferences to LocalStorage.
 * Silently swallows storage-full errors (Req 14.8).
 */
export function writePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full — continue without persisting
  }
}
