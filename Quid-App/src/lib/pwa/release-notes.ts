'use client';

const RELEASE_NOTES_URL = '/release-notes.json';
const LAST_KNOWN_RELEASE_KEY = 'quid-last-known-release';
const PENDING_RELEASE_KEY = 'quid-pending-applied-release';

export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export interface ReleaseNotesManifest {
  currentVersion: string;
  releases: ReleaseNote[];
}

export interface ReleaseSummary {
  currentVersion: string;
  fromVersion: string | null;
  releases: ReleaseNote[];
  totalChanges: number;
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage may be unavailable in private/restricted contexts.
  }
}

function readSessionStorage(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorage(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage may be unavailable in some contexts.
  }
}

function removeSessionStorage(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // sessionStorage may be unavailable in some contexts.
  }
}

export async function fetchReleaseNotes(): Promise<ReleaseNotesManifest | null> {
  try {
    const response = await fetch(`${RELEASE_NOTES_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as ReleaseNotesManifest;
    if (!data.currentVersion || !Array.isArray(data.releases)) return null;

    return data;
  } catch {
    return null;
  }
}

export function getLastKnownRelease() {
  return readStorage(LAST_KNOWN_RELEASE_KEY);
}

export function markReleaseKnown(version: string) {
  writeStorage(LAST_KNOWN_RELEASE_KEY, version);
}

export function rememberPendingAppliedRelease(version: string) {
  writeSessionStorage(PENDING_RELEASE_KEY, version);
}

export function consumePendingAppliedRelease() {
  const version = readSessionStorage(PENDING_RELEASE_KEY);
  if (version) {
    markReleaseKnown(version);
    removeSessionStorage(PENDING_RELEASE_KEY);
  }
  return version;
}

export function buildReleaseSummary(
  manifest: ReleaseNotesManifest,
  installedVersion: string | null
): ReleaseSummary {
  const fromVersion = installedVersion || getLastKnownRelease();
  const releases = [...manifest.releases];
  const installedIndex = fromVersion
    ? releases.findIndex((release) => release.version === fromVersion)
    : -1;
  const pendingReleases =
    installedIndex >= 0 ? releases.slice(0, installedIndex) : releases.slice(0, 1);

  return {
    currentVersion: manifest.currentVersion,
    fromVersion,
    releases: pendingReleases,
    totalChanges: pendingReleases.reduce((total, release) => total + release.changes.length, 0),
  };
}
