export type BillStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type PaymentStatus = 'MATCHED' | 'REQUIRES_MANUAL_REVIEW' | 'REJECTED';
export type PaymentSource = 'MOCK' | 'CSV_IMPORT';
export type ComplaintUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ComplaintStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REOPENED';
export type ClassificationSource = 'RULE_BASED' | 'AI' | 'MANUAL';

export interface BillDto {
  id: string;
  flatNumber: string;
  billingMonth: string;
  amount: number;
  lateFee: number;
  amountPaid: number;
  totalDue: number;
  status: BillStatus;
  dueDate: string;
  daysOverdue: number;
}

export interface PaymentDto {
  id: string;
  billId?: string;
  flatNumber?: string;
  amount: number;
  reference?: string;
  upiId?: string;
  transactionDate: string;
  status: PaymentStatus;
  source: PaymentSource;
  reviewNote?: string;
}

export interface ComplaintSummaryDto {
  id: string;
  flatNumber: string;
  description: string;
  category?: string;
  urgency: ComplaintUrgency;
  status: ComplaintStatus;
  classificationSource: ClassificationSource;
  createdAt: string;
}

export interface ResidentDashboardDto {
  flatNumber: string;
  residentName: string;
  totalDue: number;
  pendingBills: BillDto[];
  openComplaints: ComplaintSummaryDto[];
}

export interface DuesAgeing {
  bucket: string;
  count: number;
  amount: number;
}

export interface AdminDashboardDto {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  paidCount: number;
  unpaidCount: number;
  partialCount: number;
  reviewQueueCount: number;
  openComplaintsCount: number;
  criticalComplaintsCount: number;
  ageing: DuesAgeing[];
}

export interface CsvUploadResultDto {
  totalRows: number;
  matchedCount: number;
  reviewCount: number;
  matched: PaymentDto[];
  requiresReview: PaymentDto[];
}

export interface FlatSummaryDto {
  id: string;
  flatNumber: string;
  tower: string;
  residentName: string;
}

export interface SampleFlat {
  id: string;
  flatNumber: string;
  residentName: string;
  areaSqft: number;
  ratePerSqft: number;
  initialBill: number;
  initialPaid: number;
  initialOverdueDays: number;
  notes: string;
}

export const SAMPLE_FLATS: SampleFlat[] = [
  {
    id: 'a1000000-0000-0000-0000-000000000001',
    flatNumber: 'T07-1203',
    residentName: 'Neeraj Kulkarni',
    areaSqft: 1150,
    ratePerSqft: 6.50,
    initialBill: 7475,
    initialPaid: 7475,
    initialOverdueDays: 0,
    notes: 'Fully Paid · 0 Complaints'
  },
  {
    id: 'a1000000-0000-0000-0000-000000000002',
    flatNumber: 'T12-0408',
    residentName: 'Swati Joshi (Tenant)',
    areaSqft: 980,
    ratePerSqft: 6.50,
    initialBill: 6370,
    initialPaid: 0,
    initialOverdueDays: 47,
    notes: '47d Overdue · 1 Water Leak Complaint'
  },
  {
    id: 'a1000000-0000-0000-0000-000000000003',
    flatNumber: 'T21-1601',
    residentName: 'Aamir Shaikh',
    areaSqft: 1640,
    ratePerSqft: 6.50,
    initialBill: 10660,
    initialPaid: 5000,
    initialOverdueDays: 18,
    notes: 'Partial (₹5,000 paid) · 18d Overdue'
  }
];

