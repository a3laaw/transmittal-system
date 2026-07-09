'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {
          console.log('PWA: Service Worker registered');
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
