import Link from 'next/link';
import {
  Building2,
  Shield,
  User,
  ArrowRight,
  CheckCircle2,
  TrendingDown,
  Sparkles,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import { SAMPLE_FLATS } from '@/lib/types';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="border-b border-border bg-white py-12 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-light text-accent text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span>Isocode Internship Assignment · Pune Township MVP</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Township Facility Management & Accounts System
          </h1>

          <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Company A (Pune) · 2,400 apartments across 28 towers · ₹22–26 Cr annual maintenance budget.
            Reconciles payment chaos, eliminates ₹83.57L in leakage, and automates AI complaint routing with strict safety guardrails.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/resident"
              className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold shadow-sm"
            >
              <User className="w-4 h-4" />
              <span>Launch Resident App</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/admin"
              className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
            >
              <Shield className="w-4 h-4" />
              <span>Launch Help-Desk & Accounts Console</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Grid: Resident Slice vs Help-Desk Slice */}
      <section className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Resident App Card */}
          <div className="card space-y-4 hover:border-gray-300 transition p-6 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-accent flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondary">
                  Mobile-Optimized Slice (Max 2 Taps)
                </span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">
                  Resident Maintenance & Complaints
                </h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Check maintenance dues calculated per flat area (₹6.50/sq ft) with Maharashtra bye-law late fees.
                Execute 1-tap test payments with immediate receipting. Submit complaints with real-time emergency safety alerts.
              </p>

              {/* Sample Persona Quick Links */}
              <div className="pt-2 border-t border-border space-y-1.5">
                <span className="text-[11px] font-semibold text-text-primary">
                  Test Personas (Seed Data):
                </span>
                <div className="space-y-1 text-xs">
                  {SAMPLE_FLATS.map((f) => (
                    <Link
                      key={f.id}
                      href="/resident"
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition group"
                    >
                      <div>
                        <span className="font-semibold text-text-primary group-hover:text-accent">
                          {f.flatNumber} · {f.residentName}
                        </span>
                        <p className="text-[11px] text-text-secondary">{f.notes}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-text-secondary group-hover:translate-x-0.5 transition" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link
              href="/resident"
              className="btn-primary w-full text-center text-xs py-2.5 mt-4"
            >
              Open Resident Experience →
            </Link>
          </div>

          {/* 2. Admin Console Card */}
          <div className="card space-y-4 hover:border-gray-300 transition p-6 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 text-text-primary flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondary">
                  Desktop-Optimized Slice
                </span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">
                  Help-Desk & CSV Reconciliation
                </h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Replaces hours of Excel matching. Drop bank statement CSVs: exact amounts & references auto-match to flats.
                Ambiguous rows are diverted to the manual review queue and NEVER auto-posted.
              </p>

              <div className="pt-2 border-t border-border space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  <span>
                    <strong>Collections & Ageing:</strong> 0-30d, 31-60d, 61+d dues tracking.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  <span>
                    <strong>CSV Matching Algorithm:</strong> Resolves amounts, UPI IDs, and references.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  <span>
                    <strong>1-Tap Category Override:</strong> Staff overrides AI tags with instant re-assignment.
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/admin"
              className="btn-secondary w-full text-center text-xs py-2.5 mt-4"
            >
              Open Admin Console →
            </Link>
          </div>
        </div>

        {/* Township Economics Impact Card */}
        <div className="card bg-gray-50 border border-border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-success" />
            <h3 className="font-bold text-text-primary text-sm uppercase tracking-wide">
              Township Problem & Economics Solved
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-white rounded-lg border border-border">
              <span className="text-text-secondary font-medium">Uncollected Maintenance</span>
              <p className="text-lg font-extrabold text-danger mt-1">₹64.8 Lakh / yr</p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                3% default rate on ₹21.6 Cr billed across 2,400 flats.
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-border">
              <span className="text-text-secondary font-medium">Manual Matching Time</span>
              <p className="text-lg font-extrabold text-warning mt-1">₹8.64 Lakh / yr</p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                3 accounts staff spend 60% of their time matching bank entries.
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-border">
              <span className="text-text-secondary font-medium">Reopened Complaints</span>
              <p className="text-lg font-extrabold text-text-primary mt-1">₹10.13 Lakh / yr</p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                450 reopened complaints/mo costing 45 min each at ₹250/hr.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
