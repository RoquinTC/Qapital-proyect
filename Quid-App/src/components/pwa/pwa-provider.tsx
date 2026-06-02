'use client';

import { useState, useCallback, useEffect } from 'react';
import { useServiceWorker } from './use-service-worker';
import { InstallPrompt } from './install-prompt';
import { IosInstallPrompt } from './ios-install-prompt';
import { UpdateNotification } from './update-notification';
import { OfflineIndicator } from './offline-indicator';
import { RecurringReminder } from './recurring-reminder';
import { CheckCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  buildReleaseSummary,
  consumePendingAppliedRelease,
  fetchReleaseNotes,
  getLastKnownRelease,
  markReleaseKnown,
  rememberPendingAppliedRelease,
  type ReleaseSummary,
} from '@/lib/pwa/release-notes';

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const {
    updateAvailable,
    isOffline,
    applyUpdate,
    isSupported,
    currentVersion,
    pendingVersion,
  } = useServiceWorker();
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [releaseSummary, setReleaseSummary] = useState<ReleaseSummary | null>(null);
  const [appliedUpdate, setAppliedUpdate] = useState<{
    kind: 'manual' | 'background';
    summary: ReleaseSummary | null;
  } | null>(null);
  const [wasManuallyApplied] = useState(() => {
    try {
      const wasApplied = sessionStorage.getItem('pwa-just-updated') === 'true';
      sessionStorage.removeItem('pwa-just-updated');
      return wasApplied;
    } catch {
      return false;
    }
  });

  const handleDismissUpdate = useCallback(() => {
    setDismissedUpdate(true);
    // Re-show after 30 minutes
    setTimeout(() => setDismissedUpdate(false), 30 * 60 * 1000);
  }, []);

  const handleApplyUpdate = useCallback(() => {
    if (releaseSummary?.currentVersion) {
      rememberPendingAppliedRelease(releaseSummary.currentVersion);
    } else if (pendingVersion) {
      rememberPendingAppliedRelease(pendingVersion);
    }

    applyUpdate();
  }, [applyUpdate, pendingVersion, releaseSummary]);

  useEffect(() => {
    let cancelled = false;

    async function loadReleaseSummary() {
      if (!updateAvailable) {
        setReleaseSummary(null);
        return;
      }

      const manifest = await fetchReleaseNotes();
      if (!manifest || cancelled) return;

      const installedVersion = currentVersion || getLastKnownRelease();
      const summary = buildReleaseSummary(manifest, installedVersion);
      setReleaseSummary(summary);
    }

    loadReleaseSummary();

    return () => {
      cancelled = true;
    };
  }, [currentVersion, updateAvailable]);

  useEffect(() => {
    if (!currentVersion) return;

    const appliedVersion = currentVersion;
    const previousVersion = getLastKnownRelease();
    if (!previousVersion) {
      markReleaseKnown(appliedVersion);
      return;
    }

    if (previousVersion === appliedVersion) return;

    let cancelled = false;

    async function showAppliedUpdate() {
      const manifest = await fetchReleaseNotes();
      if (cancelled) return;

      const summary = manifest ? buildReleaseSummary(manifest, previousVersion) : null;
      if (wasManuallyApplied) {
        consumePendingAppliedRelease();
      } else {
        markReleaseKnown(appliedVersion);
      }

      setAppliedUpdate({
        kind: wasManuallyApplied ? 'manual' : 'background',
        summary,
      });
    }

    showAppliedUpdate();

    return () => {
      cancelled = true;
    };
  }, [currentVersion, wasManuallyApplied]);

  // Don't render PWA features if not supported
  if (!isSupported) {
    return (
      <>
        {children}
        <RecurringReminder />
      </>
    );
  }

  return (
    <>
      {children}
      <OfflineIndicator isOffline={isOffline} />
      <InstallPrompt />
      <IosInstallPrompt />
      <UpdateNotification
        updateAvailable={updateAvailable && !dismissedUpdate}
        releaseSummary={releaseSummary}
        onApplyUpdate={handleApplyUpdate}
        onDismiss={handleDismissUpdate}
      />
      <RecurringReminder />

      <AnimatePresence>
        {appliedUpdate && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-4 left-4 right-4 z-[100] mx-auto max-w-md"
          >
            <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-4 shadow-xl dark:border-emerald-900/40 dark:bg-gray-900">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {appliedUpdate.kind === 'background'
                      ? 'Quid se actualizó mientras no estabas'
                      : 'Quid quedó actualizado'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Estas son las novedades que ya tienes disponibles.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAppliedUpdate(null)}
                  className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  aria-label="Cerrar novedades"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {appliedUpdate.summary?.releases.length ? (
                <ul className="mt-3 space-y-1.5 rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-950/50">
                  {appliedUpdate.summary.releases.flatMap((release) => release.changes).map((change) => (
                    <li key={change} className="flex gap-2 text-xs leading-5 text-gray-700 dark:text-gray-300">
                      <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-emerald-500" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
