'use client';

import { useEffect } from 'react';

/** Register the same-origin worker; unsupported browsers simply continue online. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    let active = true;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Registration is best effort and must not block app use or imply offline support.
      if (active) return;
    });
    return () => { active = false; };
  }, []);

  return null;
}
