'use client';

import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';

export default function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setInstalled(Boolean(standalone));
    setMounted(true);
    const onPrompt = (event) => { event.preventDefault(); setInstallEvent(event); };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); setShowInstructions(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showInstructions) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setShowInstructions(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showInstructions]);

  async function install() {
    if (!installEvent) { setShowInstructions(true); return; }
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice?.outcome === 'accepted') setInstalled(true);
    } catch {
      setShowInstructions(true);
    } finally {
      setInstallEvent(null);
    }
  }

  if (!mounted || installed) return null;

  return <>
    <button type="button" className="install-app-button" onClick={install} aria-label="Install BERAFLIX on this device"><Smartphone size={16} aria-hidden="true" /><span className="install-app-label">Install</span></button>
    {showInstructions && <div className="install-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInstructions(false); }}>
      <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-dialog-title">
        <button type="button" className="icon-button install-dialog-close" onClick={() => setShowInstructions(false)} aria-label="Close install instructions"><X size={18} /></button>
        <span className="section-kicker">BERAFLIX · BY BERA TECH</span>
        <h2 id="install-dialog-title">Add BERAFLIX to your phone</h2>
        <p><b>Android · Chrome</b><br />Open the browser menu (⋮) and choose <i>Install app</i> or <i>Add to Home screen</i>.</p>
        <p><b>iPhone · Safari</b><br />Tap <i>Share</i>, then choose <i>Add to Home Screen</i>.</p>
        <p className="install-dialog-note">If this page is inside another app, open it in Chrome or Safari first. Installing creates an app shortcut; streaming still needs an internet connection.</p>
      </section>
    </div>}
  </>;
}
