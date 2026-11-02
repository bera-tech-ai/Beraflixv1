'use client';

import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function Error({ reset }) {
  return <main className="page-inner flex min-h-[58vh] flex-col items-center justify-center px-6 text-center" role="alert">
    <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-ember/30 bg-ember/10 text-orange-300"><AlertTriangle size={22} /></span>
    <p className="text-[9px] font-extrabold tracking-[.2em] text-orange-200">A MOMENTARY INTERRUPTION</p>
    <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white">This story hit a pause.</h1>
    <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">We couldn’t finish loading this screen. Your saved shelf is unchanged.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      <button type="button" onClick={() => reset()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet/30 bg-violet/10 px-4 text-sm font-bold text-violet-100"><RotateCcw size={15} /> Try again</button>
      <Link href="/" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-sm font-bold text-zinc-200">Back to Discover</Link>
    </div>
  </main>;
}
