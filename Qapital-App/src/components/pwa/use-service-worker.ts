'use client';

import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';

interface SWRegistration {
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
}

// Use useSyncExternalStore for online/offline status (avoids setState in effect)
function useOnlineStatus() {
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
    return () => {
      window.removeEventListener('online', callback);
      window.removeEventListener('offline', callback);
    };
  }, []);

  const getSnapshot = useCallback(() => {
    return navigator.onLine;
  }, []);

  const getServerSnapshot = useCallback(() => {
    return true; // Assume online on server
  }, []);

  return !useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useServiceWorker() {
  const [state, setState] = useState<SWRegistration>({
    registration: null,
    updateAvailable: false,
  });

  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const isOffline = useOnlineStatus();

  // Register the service worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('[PWA] Service Worker not supported');
      return;
    }

    async function registerSW() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('[PWA] Service Worker registered:', registration.scope);
        setState((prev) => ({ ...prev, registration }));

        // Check for updates on load
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New version available
                console.log('[PWA] New version available');
                setWaitingWorker(newWorker);
                setState((prev) => ({ ...prev, updateAvailable: true }));
              } else {
                // First install
                console.log('[PWA] Content cached for offline use');
              }
            }
          });
        });

        // Check if there's already a waiting worker
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setState((prev) => ({ ...prev, updateAvailable: true }));
        }

        // Listen for controlling SW change (after activation)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[PWA] Controller changed — new SW active');
          // Reload to get the new version
          window.location.reload();
        });

      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    }

    registerSW();
  }, []);

  // Apply update — tell the waiting SW to activate
  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;

    console.log('[PWA] Applying update...');
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });

    setState((prev) => ({ ...prev, updateAvailable: false }));
    setWaitingWorker(null);
  }, [waitingWorker]);

  // Clear all caches
  const clearCache = useCallback(async () => {
    if (state.registration?.active) {
      state.registration.active.postMessage({ type: 'CLEAR_CACHE' });
    }

    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('[PWA] All caches cleared');
  }, [state.registration]);

  return {
    ...state,
    isOffline,
    applyUpdate,
    clearCache,
    isSupported: typeof window !== 'undefined' && 'serviceWorker' in navigator,
  };
}
