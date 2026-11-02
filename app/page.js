import { Suspense } from 'react';
import { Clapperboard } from 'lucide-react';
import DiscoverScreen from '../components/DiscoverScreen';
import { getCatalog } from '../lib/catalog';

export const metadata = { title: 'Discover' };
export const dynamic = 'force-dynamic';

function DiscoverPending() {
  return <main className="page-inner route-pending" aria-busy="true">
    <span className="route-pending-mark" aria-hidden="true"><Clapperboard size={24} /></span>
    <span className="section-kicker">BERAFLIX · BY BERA TECH</span>
    <h1>Find your next watch</h1>
    <p role="status" aria-live="polite">The catalog is being prepared.</p>
  </main>;
}

async function DiscoverCatalog() {
  try {
    const catalog = await getCatalog();
    return <DiscoverScreen movies={catalog.items} sections={catalog.sections} />;
  } catch (error) {
    console.error('Discover catalog load failed:', error?.message || 'Unknown error');
    return <DiscoverScreen movies={[]} sections={[]} error />;
  }
}

export default function DiscoverPage() {
  return <Suspense fallback={<DiscoverPending />}><DiscoverCatalog /></Suspense>;
}
