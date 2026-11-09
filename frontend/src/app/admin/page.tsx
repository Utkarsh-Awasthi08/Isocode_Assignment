'use client';

import { useState, useEffect } from 'react';
import {
  AdminDashboardDto,
  ComplaintSummaryDto,
  CsvUploadResultDto,
  FlatSummaryDto,
  PaymentDto,
  BillDto,
} from '@/lib/types';
import {
  getAdminDashboard,
  getAllComplaints,
  getReviewQueue,
  getAdminFlats,
  getResidentBills,
  uploadBankCsv,
  resolvePayment,
  updateComplaintStatus,
  overrideComplaintCategory,
} from '@/lib/api';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UploadCloud,
  UserCheck,
  X,
  Building2,
  Check,
} from 'lucide-react';

const CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Civil',
  'Housekeeping',
  'Lift/Elevator',
  'Pest Control',
  'Security',
  'Common Area',
  'Safety',
  'Other',
];

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<AdminDashboardDto | null>(null);
  const [complaints, setComplaints] = useState<ComplaintSummaryDto[]>([]);
  const [reviewQueue, setReviewQueue] = useState<PaymentDto[]>([]);
  const [flats, setFlats] = useState<FlatSummaryDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Active Admin Tab
  const [adminTab, setAdminTab] = useState<'dashboard' | 'upload' | 'review' | 'complaints'>('dashboard');

  // CSV Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<CsvUploadResultDto | null>(null);

  // Complaints Filter
  const [complaintFilter, setComplaintFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CRITICAL'>('ALL');

  // Resolve Payment Modal
  const [resolvingPayment, setResolvingPayment] = useState<PaymentDto | null>(null);
  const [selectedResolveFlat, setSelectedResolveFlat] = useState<string>('');
  const [flatBills, setFlatBills] = useState<BillDto[]>([]);
  const [selectedResolveBill, setSelectedResolveBill] = useState<string>('');
  const [resolvingSubmitting, setResolvingSubmitting] = useState<boolean>(false);

  // Load Admin Data
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [dashData, compData, queueData, flatData] = await Promise.all([
          getAdminDashboard(),
          getAllComplaints(),
          getReviewQueue(),
          getAdminFlats(),
        ]);
        if (isMounted) {
          setDashboard(dashData);
          setComplaints(compData);
          setReviewQueue(queueData);
          setFlats(flatData);
        }
      } catch (err) {
        console.warn('API error, falling back to seed preview:', err);
        if (isMounted) {
          // Fallback preview
          setDashboard({
            totalBilled: 24505,
            totalCollected: 12475,
            totalOutstanding: 12030,
            paidCount: 1,
            unpaidCount: 1,
            partialCount: 1,
            reviewQueueCount: 0,
            openComplaintsCount: 1,
            criticalComplaintsCount: 0,
            ageing: [
              { bucket: 'Current (0–30 days)', count: 1, amount: 5660 },
              { bucket: '31–60 days', count: 1, amount: 6870 },
              { bucket: '61+ days', count: 0, amount: 0 },
            ],
          });
          setComplaints([
            {
              id: 'd1000000-0000-0000-0000-000000000001',
              flatNumber: 'T12-0408',
              description: 'Water leaking from bathroom ceiling, dripping continuously.',
              category: 'Plumbing',
              urgency: 'HIGH',
              status: 'OPEN',
              classificationSource: 'AI',
              createdAt: new Date().toISOString(),
            },
          ]);
          setFlats([
            { id: 'a1000000-0000-0000-0000-000000000001', flatNumber: 'T07-1203', tower: 'T07', residentName: 'Neeraj Kulkarni' },
            { id: 'a1000000-0000-0000-0000-000000000002', flatNumber: 'T12-0408', tower: 'T12', residentName: 'Swati Joshi' },
            { id: 'a1000000-0000-0000-0000-000000000003', flatNumber: 'T21-1601', tower: 'T21', residentName: 'Aamir Shaikh' },
          ]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [refreshKey]);

  // Load bills for flat in resolve modal
  useEffect(() => {
    if (!selectedResolveFlat) {
      setFlatBills([]);
      return;
    }
    getResidentBills(selectedResolveFlat)
      .then((data) => {
        const unpaidBills = data.filter((b) => b.status !== 'PAID');
        setFlatBills(unpaidBills);
        if (unpaidBills.length > 0) setSelectedResolveBill(unpaidBills[0].id);
      })
      .catch(() => setFlatBills([]));
  }, [selectedResolveFlat]);

  // Handle CSV Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    try {
      const res = await uploadBankCsv(selectedFile);
      setUploadResult(res);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.message || 'CSV upload failed');
    } finally {
      setUploading(false);
    }
  };

  // 1-Click Load Sample CSV
  const handleLoadSampleCsv = async () => {
    const sampleCsvContent = `Date,Description,Amount,Reference,UPI_ID
2024-10-05,UPI/Credit/IMPS from Neeraj Kulkarni,7475.00,UPI987001234,neeraj@okicici
2024-10-07,NEFT from Swati Joshi Tenant T12-0408,6870.00,NEFT202410070001,
2024-10-08,UPI Payment received,5660.00,UPI987005678,aamir@ybl
2024-10-09,Cash deposit unknown resident,5000.00,,
2024-10-10,UPI/Credit from unknown,999.00,UPI987009999,random@upi`;

    const blob = new Blob([sampleCsvContent], { type: 'text/csv' });
    const file = new File([blob], 'sample_bank_statement.csv', { type: 'text/csv' });
    setSelectedFile(file);
    setUploading(true);
    try {
      const res = await uploadBankCsv(file);
      setUploadResult(res);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.message || 'Sample CSV upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Handle Resolve Payment
  const handleResolveSubmit = async () => {
    if (!resolvingPayment || !selectedResolveFlat || !selectedResolveBill) return;
    setResolvingSubmitting(true);
    try {
      await resolvePayment(resolvingPayment.id, selectedResolveFlat, selectedResolveBill);
      setResolvingPayment(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.message || 'Failed to resolve payment');
    } finally {
      setResolvingSubmitting(false);
    }
  };

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    if (complaintFilter === 'ALL') return true;
    if (complaintFilter === 'CRITICAL') return c.urgency === 'CRITICAL';
    return c.status === complaintFilter;
  });

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Sub Header / Control Bar */}
      <div className="bg-white border-b border-border sticky top-16 z-30 px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-text-primary tracking-tight">
                Society Help-Desk & Accounts Console
              </h1>
              <span className="text-[11px] font-semibold bg-gray-100 text-text-secondary px-2 py-0.5 rounded">
                Pune Township Federation
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              2,400 Units · 28 Towers · Maharashtra Cooperative Societies Act Compliant
            </p>
          </div>

          {/* Admin Navigation Pills */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setAdminTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg transition ${
                adminTab === 'dashboard' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Collections & Dues
            </button>
            <button
              onClick={() => setAdminTab('upload')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                adminTab === 'upload' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>CSV Matcher</span>
            </button>
            <button
              onClick={() => setAdminTab('review')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                adminTab === 'review' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>Review Queue</span>
              {reviewQueue.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-danger text-white text-[10px]">
                  {reviewQueue.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setAdminTab('complaints')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                adminTab === 'complaints' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Smart Complaints</span>
              {complaints.filter((c) => c.status === 'OPEN').length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-accent text-white text-[10px]">
                  {complaints.filter((c) => c.status === 'OPEN').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Refresh Console"
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-gray-200 rounded-lg ml-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-6 space-y-6">
        {/* ── 1. COLLECTIONS & DUES DASHBOARD ───────────────────── */}
        {adminTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card">
                <span className="section-title">Total Billed (Sept)</span>
                <p className="text-2xl font-extrabold text-text-primary mt-1">
                  ₹{dashboard?.totalBilled?.toLocaleString('en-IN') ?? 0}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  Rate: ₹6.50/sq ft across flats
                </p>
              </div>

              <div className="card">
                <span className="section-title">Total Collected</span>
                <p className="text-2xl font-extrabold text-success mt-1">
                  ₹{dashboard?.totalCollected?.toLocaleString('en-IN') ?? 0}
                </p>
                <div className="flex items-center gap-1 text-xs text-success font-medium mt-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>
                    {dashboard?.totalBilled ? Math.round((dashboard.totalCollected / dashboard.totalBilled) * 100) : 0}% Collection Efficiency
                  </span>
                </div>
              </div>

              <div className="card">
                <span className="section-title">Total Outstanding</span>
                <p className="text-2xl font-extrabold text-danger mt-1">
                  ₹{dashboard?.totalOutstanding?.toLocaleString('en-IN') ?? 0}
                </p>
                <p className="text-xs text-danger/80 mt-1">
                  Includes late interest per bye-laws
                </p>
              </div>

              <div className="card">
                <span className="section-title">Action Queues</span>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Unmatched Payments:</span>
                  <span className={`font-bold px-2 py-0.5 rounded ${
                    (dashboard?.reviewQueueCount ?? 0) > 0 ? 'bg-danger-light text-danger' : 'bg-gray-100 text-text-primary'
                  }`}>
                    {dashboard?.reviewQueueCount ?? 0}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Open Complaints:</span>
                  <span className="font-bold px-2 py-0.5 rounded bg-blue-50 text-accent">
                    {dashboard?.openComplaintsCount ?? 0}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Critical Safety Words:</span>
                  <span className="font-bold px-2 py-0.5 rounded bg-red-100 text-danger">
                    {dashboard?.criticalComplaintsCount ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Dues Ageing Breakdown */}
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                    Dues Ageing Analysis (Maharashtra Cooperative Society Act)
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Categorized by days past due date. Dues exceeding 60 days are flagged for federation notice.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {dashboard?.ageing?.map((bucket) => (
                  <div
                    key={bucket.bucket}
                    className="p-4 rounded-xl border border-border bg-gray-50/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-primary">{bucket.bucket}</span>
                      <span className="badge-gray">{bucket.count} flat(s)</span>
                    </div>
                    <p className="text-xl font-bold text-text-primary">
                      ₹{bucket.amount?.toLocaleString('en-IN') ?? 0}
                    </p>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          bucket.bucket.includes('61+') ? 'bg-danger' : bucket.bucket.includes('31') ? 'bg-warning' : 'bg-accent'
                        }`}
                        style={{
                          width: `${dashboard?.totalOutstanding ? Math.min(100, (bucket.amount / dashboard.totalOutstanding) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample Flats Status Ledger */}
            <div className="card space-y-3">
              <span className="section-title">Township Sample Flats Ledger (Seed Data)</span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-border text-text-secondary uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Flat</th>
                      <th className="py-2.5 px-3">Resident</th>
                      <th className="py-2.5 px-3">Area</th>
                      <th className="py-2.5 px-3">Bill</th>
                      <th className="py-2.5 px-3">Paid</th>
                      <th className="py-2.5 px-3">Overdue</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3 px-3 font-bold text-text-primary">T07-1203</td>
                      <td className="py-3 px-3">Neeraj Kulkarni</td>
                      <td className="py-3 px-3">1,150 sq ft</td>
                      <td className="py-3 px-3 font-medium">₹7,475</td>
                      <td className="py-3 px-3 text-success font-semibold">₹7,475</td>
                      <td className="py-3 px-3">0 days</td>
                      <td className="py-3 px-3"><span className="badge-green">PAID</span></td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3 px-3 font-bold text-text-primary">T12-0408</td>
                      <td className="py-3 px-3">Swati Joshi (Tenant)</td>
                      <td className="py-3 px-3">980 sq ft</td>
                      <td className="py-3 px-3 font-medium">₹6,370</td>
                      <td className="py-3 px-3 text-danger font-semibold">₹0</td>
                      <td className="py-3 px-3 text-danger font-semibold">47 days</td>
                      <td className="py-3 px-3"><span className="badge-red">UNPAID (+ ₹500 fee)</span></td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3 px-3 font-bold text-text-primary">T21-1601</td>
                      <td className="py-3 px-3">Aamir Shaikh</td>
                      <td className="py-3 px-3">1,640 sq ft</td>
                      <td className="py-3 px-3 font-medium">₹10,660</td>
                      <td className="py-3 px-3 text-warning font-semibold">₹5,000</td>
                      <td className="py-3 px-3">18 days</td>
                      <td className="py-3 px-3"><span className="badge-yellow">PARTIAL (+ ₹200 fee)</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. CSV MATCHING ENGINE ────────────────────────────── */}
        {adminTab === 'upload' && (
          <div className="space-y-6">
            <div className="card space-y-4">
              <div>
                <h3 className="text-base font-bold text-text-primary">
                  Bank Statement CSV Matching Engine
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Upload daily ICICI / HDFC bank statement CSV. The matching algorithm matches rows to flats based on exact amount and UPI/NEFT reference.
                  <strong> Ambiguous payments are NEVER posted automatically</strong> — they are securely diverted to the Manual Review Queue.
                </p>
              </div>

              {/* Upload Dropzone */}
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div className="border-2 border-dashed border-border hover:border-accent rounded-xl p-8 text-center transition flex flex-col items-center justify-center space-y-3 bg-gray-50/50">
                  <div className="w-12 h-12 rounded-full bg-accent-light text-accent flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-text-primary cursor-pointer hover:text-accent">
                      <span>Click to upload statement CSV</span>
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setSelectedFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                    <p className="text-xs text-text-secondary mt-1">
                      Expected headers: <code>Date, Description, Amount, Reference, UPI_ID</code>
                    </p>
                  </div>

                  {selectedFile && (
                    <div className="inline-flex items-center gap-2 bg-white border border-border px-3 py-1.5 rounded-lg text-xs font-medium text-text-primary shadow-sm">
                      <FileText className="w-4 h-4 text-accent" />
                      <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-text-secondary hover:text-danger ml-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="submit"
                    disabled={!selectedFile || uploading}
                    className="btn-primary flex-1 w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 text-xs font-semibold disabled:opacity-50"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{uploading ? 'Processing & Reconciling...' : 'Process Bank CSV'}</span>
                  </button>

                  {/* 1-Click Load Sample CSV */}
                  <button
                    type="button"
                    onClick={handleLoadSampleCsv}
                    disabled={uploading}
                    className="btn-secondary flex-1 w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 text-xs font-semibold"
                  >
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span>1-Click Test with Sample Statement</span>
                  </button>
                </div>
              </form>

              {/* Upload Result Summary */}
              {uploadResult && (
                <div className="pt-4 border-t border-border space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-[10px] uppercase font-semibold text-text-secondary">Rows Read</span>
                      <p className="text-lg font-bold text-text-primary mt-0.5">{uploadResult.totalRows}</p>
                    </div>
                    <div className="p-3 bg-green-50 text-green-900 rounded-lg">
                      <span className="text-[10px] uppercase font-semibold text-success">Auto-Matched</span>
                      <p className="text-lg font-bold text-success mt-0.5">{uploadResult.matchedCount}</p>
                    </div>
                    <div className="p-3 bg-amber-50 text-amber-900 rounded-lg">
                      <span className="text-[10px] uppercase font-semibold text-warning">Manual Review</span>
                      <p className="text-lg font-bold text-warning mt-0.5">{uploadResult.reviewCount}</p>
                    </div>
                  </div>

                  {/* Matched Details */}
                  {uploadResult.matched.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-success uppercase">
                        ✓ Reconciled Payments (Ledger Updated)
                      </span>
                      <div className="border border-border rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 text-text-secondary uppercase">
                            <tr>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Flat</th>
                              <th className="py-2 px-3">Amount</th>
                              <th className="py-2 px-3">Reference</th>
                              <th className="py-2 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {uploadResult.matched.map((p) => (
                              <tr key={p.id}>
                                <td className="py-2 px-3">{p.transactionDate}</td>
                                <td className="py-2 px-3 font-bold text-text-primary">{p.flatNumber || 'Matched'}</td>
                                <td className="py-2 px-3 font-semibold text-success">₹{p.amount}</td>
                                <td className="py-2 px-3 font-mono text-[11px] text-text-secondary">{p.reference || p.upiId || '—'}</td>
                                <td className="py-2 px-3"><span className="badge-green">MATCHED</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Requires Review Details */}
                  {uploadResult.requiresReview.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-danger uppercase">
                        ⚠ Unmatched / Ambiguous Rows (Moved to Review Queue)
                      </span>
                      <div className="border border-border rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 text-text-secondary uppercase">
                            <tr>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Amount</th>
                              <th className="py-2 px-3">Reference</th>
                              <th className="py-2 px-3">Reason / Note</th>
                              <th className="py-2 px-3">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {uploadResult.requiresReview.map((p) => (
                              <tr key={p.id}>
                                <td className="py-2 px-3">{p.transactionDate}</td>
                                <td className="py-2 px-3 font-semibold text-danger">₹{p.amount}</td>
                                <td className="py-2 px-3 font-mono text-[11px] text-text-secondary">{p.reference || '—'}</td>
                                <td className="py-2 px-3 text-text-secondary">{p.reviewNote || 'Ambiguous amount/ref'}</td>
                                <td className="py-2 px-3">
                                  <button
                                    onClick={() => {
                                      setResolvingPayment(p);
                                      setAdminTab('review');
                                    }}
                                    className="text-xs text-accent font-semibold hover:underline"
                                  >
                                    Resolve
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 3. MANUAL REVIEW QUEUE ────────────────────────────── */}
        {adminTab === 'review' && (
          <div className="space-y-4">
            <div className="card space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    Manual Payment Reconciliation Queue
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Payments where multiple flats owe the same amount or bank descriptions were ambiguous. Accounts staff reviews and matches here.
                  </p>
                </div>
                <span className="badge-red font-semibold">{reviewQueue.length} Pending</span>
              </div>

              {reviewQueue.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden mt-3">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-text-secondary uppercase border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Ref / UPI</th>
                        <th className="py-2.5 px-3">Review Note</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reviewQueue.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="py-3 px-3">{p.transactionDate}</td>
                          <td className="py-3 px-3 font-bold text-text-primary">₹{p.amount.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-3 font-mono text-[11px] text-text-secondary">{p.reference || p.upiId || '—'}</td>
                          <td className="py-3 px-3 text-text-secondary">{p.reviewNote || 'Ambiguous'}</td>
                          <td className="py-3 px-3"><span className="badge-red">REVIEW REQUIRED</span></td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => {
                                setResolvingPayment(p);
                                if (flats.length > 0) setSelectedResolveFlat(flats[0].id);
                              }}
                              className="btn-primary py-1 px-3 text-xs"
                            >
                              Assign to Flat
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-text-secondary space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
                  <p className="font-semibold text-text-primary text-sm">Review Queue is Empty</p>
                  <p>All bank statement payments have been resolved and matched.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 4. SMART COMPLAINTS ROUTING ────────────────────────── */}
        {adminTab === 'complaints' && (
          <div className="space-y-4">
            <div className="card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <span>Township Complaints Hub</span>
                    <span className="text-[10px] font-normal bg-accent-light text-accent px-2 py-0.5 rounded-full font-semibold">
                      AI + Rule Guardrails
                    </span>
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Safety terms trigger immediate CRITICAL escalation. LLM categorizes normal text; staff can override category with 1 tap.
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold">
                  {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CRITICAL'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setComplaintFilter(tab)}
                      className={`px-2.5 py-1 rounded-md transition ${
                        complaintFilter === tab ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Complaints Feed */}
              <div className="space-y-3">
                {filteredComplaints.length > 0 ? (
                  filteredComplaints.map((c) => (
                    <div
                      key={c.id}
                      className={`border rounded-xl p-4 space-y-3 transition ${
                        c.urgency === 'CRITICAL'
                          ? 'border-red-300 bg-red-50/30'
                          : 'border-border bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-primary text-sm">{c.flatNumber}</span>
                          <span className={`badge ${
                            c.urgency === 'CRITICAL' ? 'badge-red font-bold animate-pulse' :
                            c.urgency === 'HIGH' ? 'badge-red' :
                            c.urgency === 'MEDIUM' ? 'badge-yellow' : 'badge-gray'
                          }`}>
                            {c.urgency}
                          </span>
                          <span className={`badge ${c.status === 'RESOLVED' ? 'badge-green' : 'badge-yellow'}`}>
                            {c.status}
                          </span>
                          <span className="badge-gray font-mono text-[10px]">
                            {c.classificationSource}
                          </span>
                        </div>

                        <span className="text-[11px] text-text-secondary">
                          {new Date(c.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      <p className="text-xs text-text-primary font-medium leading-relaxed">
                        &quot;{c.description}&quot;
                      </p>

                      {/* 1-Tap Category Override & Status Update Bar */}
                      <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                        {/* 1-Tap Category Override */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-text-secondary font-medium">Category:</span>
                          <select
                            aria-label="Complaint Category"
                            value={c.category || 'Other'}
                            onChange={async (e) => {
                              try {
                                await overrideComplaintCategory(c.id, e.target.value);
                                setRefreshKey((k) => k + 1);
                              } catch (err: any) {
                                alert(err.message);
                              }
                            }}
                            className="bg-gray-50 border border-border rounded-md px-2 py-1 text-xs font-medium text-text-primary focus:ring-1 focus:ring-accent"
                          >
                            {CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Status Transition Buttons */}
                        <div className="flex items-center gap-1.5">
                          {c.status !== 'IN_PROGRESS' && c.status !== 'RESOLVED' && (
                            <button
                              onClick={async () => {
                                await updateComplaintStatus(c.id, 'IN_PROGRESS');
                                setRefreshKey((k) => k + 1);
                              }}
                              className="btn-secondary py-1 px-2.5 text-[11px]"
                            >
                              Assign In-Progress
                            </button>
                          )}
                          {c.status !== 'RESOLVED' && (
                            <button
                              onClick={async () => {
                                await updateComplaintStatus(c.id, 'RESOLVED');
                                setRefreshKey((k) => k + 1);
                              }}
                              className="btn-primary py-1 px-2.5 text-[11px] bg-success hover:bg-green-700"
                            >
                              Mark Resolved
                            </button>
                          )}
                          {c.status === 'RESOLVED' && (
                            <button
                              onClick={async () => {
                                await updateComplaintStatus(c.id, 'REOPENED');
                                setRefreshKey((k) => k + 1);
                              }}
                              className="btn-secondary py-1 px-2.5 text-[11px] text-danger border-danger/30 hover:bg-red-50"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-xs text-text-secondary">
                    No complaints matching &quot;{complaintFilter}&quot;.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── RESOLVE PAYMENT MODAL ──────────────────────────────── */}
      {resolvingPayment && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text-primary">
                  Manually Resolve Unmatched Payment
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Link ₹{resolvingPayment.amount} transaction to a flat & unpaid bill
                </p>
              </div>
              <button
                onClick={() => setResolvingPayment(null)}
                className="p-1 rounded-lg text-text-secondary hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5 font-mono">
              <div>Amount: <strong className="text-text-primary font-bold">₹{resolvingPayment.amount}</strong></div>
              <div>Date: {resolvingPayment.transactionDate}</div>
              <div>Ref: {resolvingPayment.reference || resolvingPayment.upiId || '—'}</div>
              <div className="text-danger font-sans">{resolvingPayment.reviewNote}</div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">1. Select Target Flat</label>
                <select
                  aria-label="Select Target Flat"
                  value={selectedResolveFlat}
                  onChange={(e) => setSelectedResolveFlat(e.target.value)}
                  className="input text-xs"
                >
                  <option value="">Select a flat...</option>
                  {flats.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.flatNumber} — {f.residentName} (Tower {f.tower})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">2. Select Unpaid Bill</label>
                <select
                  aria-label="Select Unpaid Bill"
                  value={selectedResolveBill}
                  onChange={(e) => setSelectedResolveBill(e.target.value)}
                  className="input text-xs"
                  disabled={!selectedResolveFlat || flatBills.length === 0}
                >
                  {flatBills.length > 0 ? (
                    flatBills.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.billingMonth} · Outstanding Due: ₹{b.totalDue} ({b.status})
                      </option>
                    ))
                  ) : (
                    <option value="">
                      {selectedResolveFlat ? 'No unpaid bills found for this flat' : 'Choose flat first'}
                    </option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolvingPayment(null)}
                className="btn-secondary flex-1 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedResolveFlat || !selectedResolveBill || resolvingSubmitting}
                onClick={handleResolveSubmit}
                className="btn-primary flex-1 py-2 text-xs disabled:opacity-50"
              >
                {resolvingSubmitting ? 'Posting...' : 'Reconcile & Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
