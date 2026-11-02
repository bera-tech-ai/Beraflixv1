'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Bookmark, Compass, Download, House, Search, UserRound, X } from 'lucide-react';
import { ShelfProvider } from './ShelfProvider';
import InstallAppButton from './InstallAppButton';
import { OfflineVaultProvider } from './OfflineVaultProvider';
import ServiceWorkerRegister from './ServiceWorkerRegister';

const destinations = [
  { href: '/', label: 'Discover', icon: House },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/shelf', label: 'My Shelf', icon: Bookmark },
  { href: '/downloads', label: 'Downloads', icon: Download },
  { href: '/profile', label: 'Profile', icon: UserRound }
];

function Brand({ compact = false }) {
  return (
    <Link href="/" className={`brand-lockup ${compact ? 'brand-lockup-compact' : ''}`} aria-label="BERAFLIX by Bera Tech — Discover">
      <svg className="brand-symbol" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M4 7h11l29 17-29 17H4V31h8l12-7-12-7H4V7Z" fill="#F01436"/>
      </svg>
      <span className="brand-type"><strong>BERA<span>FLIX</span></strong><small>BY BERA TECH</small></span>
    </Link>
  );
}

function isActive(pathname, href) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/movie/') || pathname.startsWith('/watch/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation({ mobile = false }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className={mobile ? 'mobile-nav' : 'side-nav'}>
      {destinations.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`nav-link ${active ? 'is-active' : ''}`}>
          <Icon size={19} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
          <span>{label}</span>
          {active && !mobile && <i aria-hidden="true" />}
        </Link>;
      })}
    </nav>
  );
}

function Header() {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  return <header className="topbar">
    <div className="topbar-mobile-brand"><Brand compact /></div>
    <div className="topbar-caption"><span className="status-dot" /> BERAFLIX · STREAMING CATALOG</div>
    <div className="topbar-actions">
      <form action="/explore" method="get" role="search" className={`top-search ${mobileSearchOpen ? 'is-expanded' : ''}`}>
        <Search size={17} aria-hidden="true" />
        <input type="search" name="q" placeholder="Search titles" aria-label="Search movies and series" autoFocus={mobileSearchOpen} />
        <button type="submit" aria-label="Search catalog"><ArrowRight size={15} /></button>
        <button type="button" className="mobile-search-toggle" aria-label={mobileSearchOpen ? 'Close search' : 'Open search'} onClick={() => setMobileSearchOpen((open) => !open)}>{mobileSearchOpen ? <X size={16} /> : <Search size={16} />}</button>
      </form>
      <InstallAppButton />
      <Link href="/profile" className="profile-avatar" aria-label="Open profile" title="Profile"><UserRound size={17} aria-hidden="true" /></Link>
    </div>
  </header>;
}

export default function AppShell({ children }) {
  return <ShelfProvider>
    <OfflineVaultProvider>
    <ServiceWorkerRegister />
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#F01436] focus:px-4 focus:py-2 focus:text-white">Skip to main content</a>
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Brand />
        <p className="sidebar-label">YOUR SPACE</p>
        <Navigation />
        <div className="sidebar-bottom"><span className="sidebar-glow" /><p>Stories that<br/><b>stay with you.</b></p><small>BERAFLIX · BY BERA TECH</small></div>
      </aside>
      <div className="main-column">
        <Header />
        <div className="page-content" id="main-content" tabIndex={-1}>{children}</div>
      </div>
      <Navigation mobile />
    </div>
    </OfflineVaultProvider>
  </ShelfProvider>;
}
