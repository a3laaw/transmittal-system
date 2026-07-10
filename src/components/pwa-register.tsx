'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('PWA: Service Worker registered, version v6');

          // Listen for new SW taking over, then force reload once
          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            console.log('PWA: New SW activated, reloading page...');
            window.location.reload();
          });

          // If there's a new SW waiting, force it to activate immediately
          if (reg.waiting) {
            console.log('PWA: New SW waiting, activating...');
            reg.waiting.postMessage('SKIP_WAITING');
          }
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New SW installed — force it to take over
                  console.log('PWA: New SW installed, forcing activation...');
                  newWorker.postMessage('SKIP_WAITING');
                }
              });
            }
          });
        })
        .catch((err) => {
          console.log('PWA: SW registration failed', err);
        });
    }

    // PWA install prompt
    let deferredPrompt: any = null;
    
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      console.log('PWA: Install prompt available');
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA: App installed successfully');
    });
  }, []);

  return null;
}
