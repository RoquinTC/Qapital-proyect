'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user previously dismissed
    const dismissedTime = localStorage.getItem('qapital-install-dismissed');
    if (dismissedTime) {
      const dismissed = parseInt(dismissedTime, 10);
      const hoursSinceDismissed = (Date.now() - dismissed) / (1000 * 60 * 60);
      // Show again after 48 hours
      if (hoursSinceDismissed < 48) {
        return;
      }
    }

    // Listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show banner after a short delay (don't be too aggressive)
      setTimeout(() => {
        setShowBanner(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
      console.log('[PWA] App installed successfully');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('[PWA] User accepted install prompt');
      } else {
        console.log('[PWA] User dismissed install prompt');
      }
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
    } finally {
      setDeferredPrompt(null);
      setShowBanner(false);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem('qapital-install-dismissed', Date.now().toString());
  }, []);

  // Don't render if already installed or no prompt available
  if (isInstalled || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 p-4 overflow-hidden relative">
            {/* Green accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />

            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5 text-emerald-600" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">
                  Instalar Qapital
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Accede más rápido y úsala sin conexión. Se instala en segundos.
                </p>

                {/* Buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleInstall}
                    className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    Instalar App
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Ahora no
                  </button>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
