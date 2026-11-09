'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Shield, User, ArrowUpRight } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const isResident = pathname?.startsWith('/resident');
  const isAdmin = pathname?.startsWith('/admin');

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-text-primary text-white flex items-center justify-center font-bold text-base shadow-sm group-hover:bg-accent transition-colors">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base text-text-primary tracking-tight">
                Isocode
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-gray-100 text-text-secondary">
                Pune
              </span>
            </div>
            <p className="text-[11px] text-text-secondary leading-none">
              Township Facility Management
            </p>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/resident"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isResident
                ? 'bg-accent-light text-accent border border-accent/20'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Resident View</span>
            <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 bg-white/60 rounded">
              Mobile
            </span>
          </Link>

          <Link
            href="/admin"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isAdmin
                ? 'bg-text-primary text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Help-Desk / Admin</span>
            <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 bg-white/20 rounded">
              Desktop
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

