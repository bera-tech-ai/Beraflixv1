import { Clapperboard } from 'lucide-react';

export default function Loading() {
  return <main className="page-inner route-pending" aria-busy="true">
    <span className="route-pending-mark" aria-hidden="true"><Clapperboard size={24} /></span>
    <span className="section-kicker">BERAFLIX · BY BERA TECH</span>
    <h1>Find your next watch</h1>
    <p role="status" aria-live="polite">Your page is getting ready.</p>
  </main>;
}
