'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  SAMPLE_FLATS,
  SampleFlat,
  ResidentDashboardDto,
  BillDto,
  ComplaintSummaryDto,
  PaymentDto,
} from '@/lib/types';
import {
  getResidentDashboard,
  getResidentBills,
  processMockPayment,
  submitComplaint,
} from '@/lib/api';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Flame,
  HelpCircle,
  Home,
  MessageSquarePlus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Zap,
  ArrowRight,
  ChevronRight,
  X,
  Send,
  Building,
} from 'lucide-react';

const EMERGENCY_WORDS = ['fire', 'gas', 'gas leak', 'lift stuck', 'stuck in lift', 'shock', 'electric shock', 'smoke', 'burning', 'flood', 'explosion'];

export default function ResidentPage() {
  const [selectedFlat, setSelectedFlat] = useState<SampleFlat>(SAMPLE_FLATS[1]); // Default to Swati Joshi (unpaid bill + 1 complaint)
  const [dashboard, setDashboard] = useState<ResidentDashboardDto | null>(null);
  const [bills, setBills] = useState<BillDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Modals & form state
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payLoading, setPayLoading] = useState<boolean>(false);
  const [paySuccess, setPaySuccess] = useState<PaymentDto | null>(null);

  const [complaintText, setComplaintText] = useState<string>('');
  const [complaintSubmitting, setComplaintSubmitting] = useState<boolean>(false);
  const [complaintSuccess, setComplaintSuccess] = useState<ComplaintSummaryDto | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'complaints' | 'bills'>('home');

  // Check emergency keywords in real time
  const detectedEmergency = EMERGENCY_WORDS.find((w) =>
    complaintText.toLowerCase().includes(w)
  );

  // Load data for selected flat
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [dashData, billsData] = await Promise.all([
          getResidentDashboard(selectedFlat.id),
          getResidentBills(selectedFlat.id),
        ]);
        if (isMounted) {
          setDashboard(dashData);
          setBills(billsData);
        }
      } catch (err) {
        console.warn('API error, falling back to local seed preview:', err);
        // Fallback preview in case backend is offline
        if (isMounted) {
          setDashboard({
            flatNumber: selectedFlat.flatNumber,
            residentName: selectedFlat.residentName,
            totalDue: Math.max(0, selectedFlat.initialBill - selectedFlat.initialPaid),
            pendingBills: selectedFlat.initialBill > selectedFlat.initialPaid ? [
              {
                id: 'c1000000-0000-0000-0000-000000000002',
                flatNumber: selectedFlat.flatNumber,
                billingMonth: '2024-09-01',
                amount: selectedFlat.initialBill,
                lateFee: selectedFlat.initialOverdueDays > 0 ? 500 : 0,
                amountPaid: selectedFlat.initialPaid,
                totalDue: selectedFlat.initialBill - selectedFlat.initialPaid + (selectedFlat.initialOverdueDays > 0 ? 500 : 0),
                status: selectedFlat.initialPaid === 0 ? 'UNPAID' : 'PARTIAL',
                dueDate: '2024-09-15',
                daysOverdue: selectedFlat.initialOverdueDays,
              }
            ] : [],
            openComplaints: selectedFlat.initialOverdueDays > 30 ? [
              {
                id: 'd1000000-0000-0000-0000-000000000001',
                flatNumber: selectedFlat.flatNumber,
                description: 'Water leaking from bathroom ceiling, dripping continuously.',
                category: 'Plumbing',
                urgency: 'HIGH',
                status: 'OPEN',
                classificationSource: 'AI',
                createdAt: new Date().toISOString(),
              }
            ] : [],
          });
          setBills([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [selectedFlat, refreshKey]);

  // Handle Mock Payment
  const handlePay = async (billId: string, amount: number) => {
    setPayLoading(true);
    try {
      const res = await processMockPayment(selectedFlat.id, billId, amount);
      setPaySuccess(res);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.message || 'Payment failed');
    } finally {
      setPayLoading(false);
    }
  };

  // Handle Submit Complaint
  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintText.trim() || complaintText.length < 5) return;
    setComplaintSubmitting(true);
    try {
      const res = await submitComplaint(selectedFlat.id, complaintText);
      setComplaintSuccess(res);
      setComplaintText('');
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.message || 'Could not submit complaint');
    } finally {
      setComplaintSubmitting(false);
    }
  };

  const pendingBill = dashboard?.pendingBills?.[0];
  const totalDueAmount = dashboard?.totalDue ?? 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Mobile Top Bar */}
      <div className="bg-white border-b border-border sticky top-16 z-40 px-4 py-2.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondary">
              Resident Flat
            </span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-text-primary text-base">
                {selectedFlat.flatNumber}
              </span>
              <span className="text-xs text-text-secondary">
                · {selectedFlat.residentName}
              </span>
            </div>
          </div>

          {/* Quick Flat Switcher Dropdown */}
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Select Flat"
              value={selectedFlat.id}
              onChange={(e) => {
                const found = SAMPLE_FLATS.find((f) => f.id === e.target.value);
                if (found) {
                  setSelectedFlat(found);
                  setPaySuccess(null);
                  setComplaintSuccess(null);
                }
              }}
              className="text-xs bg-gray-50 border border-border rounded-lg px-2.5 py-1.5 font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {SAMPLE_FLATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.flatNumber} ({f.residentName.split(' ')[0]})
                </option>
              ))}
            </select>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Refresh"
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-gray-100 rounded-lg transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Sample Profile Banner */}
        <div className="text-xs bg-blue-50/70 border border-blue-200/60 rounded-xl p-3 flex items-start justify-between gap-3 text-blue-900">
          <div>
            <span className="font-semibold">{selectedFlat.notes}</span>
            <p className="text-[11px] text-blue-700/80 mt-0.5">
              Area: {selectedFlat.areaSqft} sq ft · Rate: ₹{selectedFlat.ratePerSqft.toFixed(2)}/sq ft/mo
            </p>
          </div>
          <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
            Seed Case
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 bg-gray-100/80 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeTab === 'home'
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('complaints')}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'complaints'
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span>Complaints</span>
            {(dashboard?.openComplaints?.length ?? 0) > 0 && (
              <span className="w-4 h-4 rounded-full bg-accent text-white text-[10px] flex items-center justify-center">
                {dashboard?.openComplaints.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('bills')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeTab === 'bills'
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Bills Ledger
          </button>
        </div>

        {/* ── HOME TAB ────────────────────────────────────────────── */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* Dues Card */}
            <div className="card relative overflow-hidden bg-white border border-border">
              <div className="flex items-start justify-between">
                <div>
                  <span className="section-title">Current Maintenance Dues</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-text-primary">
                      ₹{totalDueAmount.toLocaleString('en-IN')}
                    </span>
                    {totalDueAmount === 0 ? (
                      <span className="badge-green">Fully Paid</span>
                    ) : (
                      <span className="badge-red">
                        {pendingBill?.daysOverdue ? `${pendingBill.daysOverdue}d overdue` : 'Payment Due'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-10 h-10 rounded-full bg-gray-50 border border-border flex items-center justify-center text-text-secondary">
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>

              {/* Bill Details Breakdown */}
              {pendingBill ? (
                <div className="mt-4 pt-3 border-t border-border/60 text-xs space-y-1.5 text-text-secondary">
                  <div className="flex justify-between">
                    <span>Base Monthly Bill ({selectedFlat.areaSqft} sqft × ₹6.50)</span>
                    <span className="font-medium text-text-primary">₹{pendingBill.amount.toLocaleString('en-IN')}</span>
                  </div>
                  {pendingBill.lateFee > 0 && (
                    <div className="flex justify-between text-danger">
                      <span>Late Fee (Maharashtra Bye-Laws)</span>
                      <span className="font-semibold">+ ₹{pendingBill.lateFee.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {pendingBill.amountPaid > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Already Paid</span>
                      <span className="font-semibold">- ₹{pendingBill.amountPaid.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold pt-1 text-text-primary border-t border-dashed border-border/80">
                    <span>Net Payable</span>
                    <span className="text-accent font-bold text-sm">₹{pendingBill.totalDue.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-text-secondary pt-2 border-t border-border/50">
                  No pending bills. September maintenance is cleared!
                </p>
              )}

              {/* Action Button: Pay Now (Max 2 Taps) */}
              {pendingBill && pendingBill.totalDue > 0 ? (
                <button
                  onClick={() => {
                    setPayAmount(String(pendingBill.totalDue));
                    setShowPayModal(true);
                  }}
                  className="mt-4 w-full btn-primary flex items-center justify-center gap-2 py-3 text-sm font-semibold"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Pay ₹{pendingBill.totalDue.toLocaleString('en-IN')} Now</span>
                </button>
              ) : (
                <div className="mt-4 py-2 px-3 bg-success-light text-success rounded-lg text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>All maintenance bills are up to date!</span>
                </div>
              )}
            </div>

            {/* Quick Raise Complaint Teaser */}
            <div className="card flex items-center justify-between p-4 hover:border-gray-300 cursor-pointer transition"
                 onClick={() => setActiveTab('complaints')}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                  <MessageSquarePlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Need Help or Maintenance?</h2>
                  <p className="text-xs text-text-secondary">Smart AI categorization & urgency routing</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-secondary" />
            </div>

            {/* Active Complaints Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="section-title">Open Complaints ({dashboard?.openComplaints.length ?? 0})</span>
                <button
                  onClick={() => setActiveTab('complaints')}
                  className="text-xs text-accent font-semibold hover:underline"
                >
                  View all
                </button>
              </div>

              {dashboard?.openComplaints && dashboard.openComplaints.length > 0 ? (
                dashboard.openComplaints.map((c) => (
                  <div key={c.id} className="card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`badge ${
                          c.urgency === 'CRITICAL' ? 'badge-red animate-pulse' :
                          c.urgency === 'HIGH' ? 'badge-red' :
                          c.urgency === 'MEDIUM' ? 'badge-yellow' : 'badge-gray'
                        }`}>
                          {c.urgency}
                        </span>
                        <span className="badge-blue">{c.category || 'General'}</span>
                        <span className="text-[10px] text-text-secondary bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          {c.classificationSource}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-secondary">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-text-primary font-medium line-clamp-2">
                      {c.description}
                    </p>
                  </div>
                ))
              ) : (
                <div className="card text-center py-6 text-xs text-text-secondary">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-1.5 text-gray-400" />
                  No open complaints for this flat.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── COMPLAINTS TAB ──────────────────────────────────────── */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {/* New Complaint Form */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <span className="section-title">Raise New Complaint</span>
                <span className="text-[10px] text-text-secondary flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-accent" />
                  AI Assisted
                </span>
              </div>

              {/* Real-time Emergency Keyword Warning */}
              {detectedEmergency && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-danger text-xs flex items-start gap-2">
                  <Flame className="w-4 h-4 shrink-0 text-danger mt-0.5 animate-bounce" />
                  <div>
                    <span className="font-bold">Safety Rule Triggered: &quot;{detectedEmergency}&quot;</span>
                    <p className="text-[11px] text-red-700 mt-0.5">
                      Will instantly route to <strong>Duty Manager</strong> with <strong>CRITICAL</strong> priority (bypassing AI queue).
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleComplaintSubmit} className="space-y-3">
                <textarea
                  rows={3}
                  value={complaintText}
                  onChange={(e) => setComplaintText(e.target.value)}
                  placeholder="Describe your issue (e.g. Water dripping from bathroom ceiling, lift stuck on 5th floor...)"
                  className="input text-xs resize-none"
                  required
                />

                {/* Quick chip suggestions */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-text-secondary">Quick Examples:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Water leaking from master bedroom ceiling pipe',
                      'Lift stuck with 2 people inside tower B',
                      'Electric sparks and smell from hallway switchboard',
                      'Corridor lighting out on 12th floor',
                    ].map((sample) => (
                      <button
                        type="button"
                        key={sample}
                        onClick={() => setComplaintText(sample)}
                        className="text-[10px] bg-gray-100 hover:bg-gray-200 text-text-primary px-2 py-1 rounded-md transition text-left"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={complaintSubmitting || !complaintText.trim()}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{complaintSubmitting ? 'Analyzing & Routing...' : 'Submit Complaint'}</span>
                </button>
              </form>

              {/* Feedback Alert */}
              {complaintSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs space-y-1 text-green-900">
                  <div className="flex items-center gap-1.5 font-bold text-success">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complaint Registered & Classified!</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] pt-1">
                    <span>Category: <strong>{complaintSuccess.category}</strong></span>
                    <span>·</span>
                    <span>Urgency: <strong className="text-danger">{complaintSuccess.urgency}</strong></span>
                    <span>·</span>
                    <span>Source: <strong>{complaintSuccess.classificationSource}</strong></span>
                  </div>
                </div>
              )}
            </div>

            {/* Complaints List */}
            <div className="space-y-2">
              <span className="section-title">All Registered Complaints</span>
              {dashboard?.openComplaints && dashboard.openComplaints.length > 0 ? (
                dashboard.openComplaints.map((c) => (
                  <div key={c.id} className="card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`badge ${
                          c.urgency === 'CRITICAL' ? 'badge-red font-bold' :
                          c.urgency === 'HIGH' ? 'badge-red' :
                          c.urgency === 'MEDIUM' ? 'badge-yellow' : 'badge-gray'
                        }`}>
                          {c.urgency}
                        </span>
                        <span className="badge-blue">{c.category || 'General'}</span>
                        <span className="badge-gray font-mono text-[10px]">{c.classificationSource}</span>
                      </div>
                      <span className={`badge ${c.status === 'RESOLVED' ? 'badge-green' : 'badge-yellow'}`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-text-primary">{c.description}</p>
                    <div className="text-[10px] text-text-secondary flex items-center justify-between border-t border-border/40 pt-1.5">
                      <span>Assigned to: Helpdesk / Maintenance</span>
                      <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="card text-center py-6 text-xs text-text-secondary">
                  No complaints filed yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BILLS TAB ───────────────────────────────────────────── */}
        {activeTab === 'bills' && (
          <div className="space-y-4">
            <div className="card space-y-3">
              <span className="section-title">Flat Maintenance History</span>
              <div className="space-y-2">
                {bills.length > 0 ? (
                  bills.map((b) => (
                    <div key={b.id} className="border border-border rounded-lg p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text-primary">
                          {new Date(b.billingMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        </span>
                        <span className={`badge ${
                          b.status === 'PAID' ? 'badge-green' :
                          b.status === 'PARTIAL' ? 'badge-yellow' : 'badge-red'
                        }`}>
                          {b.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] text-text-secondary pt-1">
                        <div>
                          <p className="label">Amount</p>
                          <p className="font-semibold text-text-primary">₹{b.amount}</p>
                        </div>
                        <div>
                          <p className="label">Paid</p>
                          <p className="font-semibold text-success">₹{b.amountPaid}</p>
                        </div>
                        <div>
                          <p className="label">Due</p>
                          <p className="font-semibold text-danger">₹{b.totalDue}</p>
                        </div>
                      </div>
                      {b.status !== 'PAID' && (
                        <button
                          onClick={() => {
                            setPayAmount(String(b.totalDue));
                            setShowPayModal(true);
                          }}
                          className="mt-2 w-full btn-primary py-1.5 text-xs font-medium"
                        >
                          Pay Due (₹{b.totalDue})
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-xs text-text-secondary">
                    Loading billing history...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MOCK PAYMENT MODAL ────────────────────────────────────── */}
      {showPayModal && pendingBill && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text-primary">Authorize Payment</h3>
                <p className="text-xs text-text-secondary">Simulated Test Gateway · Society Bye-laws</p>
              </div>
              <button
                onClick={() => {
                  setShowPayModal(false);
                  setPaySuccess(null);
                }}
                className="p-1 rounded-lg text-text-secondary hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paySuccess ? (
              <div className="space-y-4 py-2 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 text-success mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-text-primary text-base">Payment Completed!</h4>
                  <p className="text-xs text-text-secondary mt-1">
                    Amount of ₹{paySuccess.amount} credited to flat {selectedFlat.flatNumber}.
                  </p>
                  <p className="text-[11px] font-mono text-gray-500 mt-1">
                    Ref: {paySuccess.reference}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPayModal(false);
                    setPaySuccess(null);
                  }}
                  className="btn-primary w-full text-xs py-2.5"
                >
                  Close & Refresh Ledger
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Flat Number:</span>
                    <span className="font-bold text-text-primary">{selectedFlat.flatNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Outstanding Due:</span>
                    <span className="font-bold text-danger">₹{pendingBill.totalDue}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="label">Payment Amount (₹)</label>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="input text-base font-bold"
                    max={pendingBill.totalDue}
                    min={1}
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(pendingBill.totalDue))}
                      className="text-[11px] text-accent font-semibold hover:underline"
                    >
                      Pay Full (₹{pendingBill.totalDue})
                    </button>
                    {pendingBill.totalDue > 1000 && (
                      <button
                        type="button"
                        onClick={() => setPayAmount('1000')}
                        className="text-[11px] text-text-secondary hover:underline"
                      >
                        Pay Partial (₹1,000)
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-900 text-[11px] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-blue-600" />
                  <span>Test mode: Instant settlement to society account with mock UPI reference.</span>
                </div>

                <button
                  onClick={() => handlePay(pendingBill.id, parseFloat(payAmount) || pendingBill.totalDue)}
                  disabled={payLoading || !payAmount || parseFloat(payAmount) <= 0}
                  className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{payLoading ? 'Processing...' : `Confirm & Pay ₹${payAmount || pendingBill.totalDue}`}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
