const PREFS_KEY = 'railwatch_user_prefs';

export interface UserPreferences {
  panelCollapseState: Record<string, boolean>;
  refreshInterval: number; // milliseconds
}

const DEFAULTS: UserPreferences = {
  panelCollapseState: {},
  refreshInterval: 30_000,
};

// ─── Storage-full state (Req 18.9) ───────────────────────────────────────────

/** True when the last write to LocalStorage failed due to storage quota exceeded. */
let _storageFullDetected = false;

/** Returns true if a storage-full error has been detected since page load. */
export function isStorageFull(): boolean {
  return _storageFullDetected;
}

/** Resets the storage-full flag (used in tests). */
export function resetStorageFullFlag(): void {
  _storageFullDetected = false;
}

// ─── Read / Write ─────────────────────────────────────────────────────────────

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
 * On storage-full error: sets the storageFullDetected flag and continues (Req 14.8, Req 18.9).
 */
export function writePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full — set flag so UI can show non-blocking notice (Req 18.9)
    _storageFullDetected = true;
  }
}
