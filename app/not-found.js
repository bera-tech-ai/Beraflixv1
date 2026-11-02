import Link from 'next/link';
import { ArrowLeft, Film } from 'lucide-react';

export default function NotFound() {
  return <main className="page-inner screen-page"><div className="notice-card"><span className="notice-icon"><Film size={22} /></span><div><h3>This title isn’t in the catalog.</h3><p>It may have moved, or the link may be incomplete. Try another story from BERAFLIX.</p></div></div><Link href="/" className="text-link back-link" style={{ marginTop: 18 }}><ArrowLeft size={15} /> Back to Discover</Link></main>;
}
