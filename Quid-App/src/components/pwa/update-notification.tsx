'use client';

import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReleaseSummary } from '@/lib/pwa/release-notes';

interface UpdateNotificationProps {
  updateAvailable: boolean;
  releaseSummary: ReleaseSummary | null;
  onApplyUpdate: () => void;
  onDismiss: () => void;
}

export function UpdateNotification({
  updateAvailable,
  releaseSummary,
  onApplyUpdate,
  onDismiss,
}: UpdateNotificationProps) {
  const [updating, setUpdating] = useState(false);
  const visibleReleases = releaseSummary?.releases ?? [];
  const releaseCount = visibleReleases.length;
  const hasReleaseNotes = releaseCount > 0;

  const handleUpdate = () => {
    setUpdating(true);
    // Store flag so the app can show a confirmation toast after reload
    try {
      sessionStorage.setItem('pwa-just-updated', 'true');
    } catch {
      // sessionStorage may be unavailable in some contexts
    }
    onApplyUpdate();
  };

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          initial={{ opacity: 0, y: -80, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -80, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-4 left-4 right-4 z-[100] mx-auto max-w-md"
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-emerald-100 dark:border-emerald-900/40 p-4 overflow-hidden relative">
            {/* Green accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />

            <div className="flex items-center gap-3">
              {/* Icon with animation */}
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                <RefreshCw
                  className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin"
                  style={{ animationDuration: updating ? '1s' : '3s' }}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {updating ? 'Actualizando...' : 'Actualización disponible'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {updating
                    ? 'La app se reiniciará en un momento.'
                    : hasReleaseNotes && releaseCount > 1
                      ? `Incluye ${releaseCount} versiones pendientes por aplicar.`
                      : 'Hay una nueva versión de Quid lista para usar.'}
                </p>
              </div>

              {/* Actions: hide dismiss while updating */}
              {!updating && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={handleUpdate}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={onDismiss}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {!updating && hasReleaseNotes && (
              <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-950/50">
                <div className="space-y-3">
                  {visibleReleases.map((release) => (
                    <div key={release.version}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {release.title}
                        </p>
                        <span className="flex-shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
                          {release.date}
                        </span>
                      </div>
                      <ul className="mt-1.5 space-y-1">
                        {release.changes.map((change) => (
                          <li
                            key={change}
                            className="flex gap-2 text-xs leading-5 text-gray-700 dark:text-gray-300"
                          >
                            <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-emerald-500" />
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
