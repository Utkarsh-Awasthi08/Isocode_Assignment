import {
  AdminDashboardDto,
  BillDto,
  ComplaintSummaryDto,
  CsvUploadResultDto,
  FlatSummaryDto,
  PaymentDto,
  ResidentDashboardDto,
} from './types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errorJson = await res.json();
      if (errorJson.message) errorMsg = errorJson.message;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

// ── Resident API ──────────────────────────────────────────────────

export async function getResidentDashboard(flatId: string): Promise<ResidentDashboardDto> {
  return fetchJson<ResidentDashboardDto>(`${API_BASE}/resident/dashboard?flatId=${flatId}`);
}

export async function getResidentBills(flatId: string): Promise<BillDto[]> {
  return fetchJson<BillDto[]>(`${API_BASE}/resident/bills?flatId=${flatId}`);
}

export async function getResidentComplaints(flatId: string): Promise<ComplaintSummaryDto[]> {
  return fetchJson<ComplaintSummaryDto[]>(`${API_BASE}/resident/complaints?flatId=${flatId}`);
}

export async function processMockPayment(
  flatId: string,
  billId: string,
  amount: number
): Promise<PaymentDto> {
  return fetchJson<PaymentDto>(`${API_BASE}/resident/payments/mock?flatId=${flatId}`, {
    method: 'POST',
    body: JSON.stringify({ billId, amount }),
  });
}

export async function submitComplaint(
  flatId: string,
  description: string
): Promise<ComplaintSummaryDto> {
  return fetchJson<ComplaintSummaryDto>(`${API_BASE}/resident/complaints?flatId=${flatId}`, {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
}

// ── Admin API ─────────────────────────────────────────────────────

export async function getAdminDashboard(): Promise<AdminDashboardDto> {
  return fetchJson<AdminDashboardDto>(`${API_BASE}/admin/dashboard`);
}

export async function getAdminFlats(): Promise<FlatSummaryDto[]> {
  return fetchJson<FlatSummaryDto[]>(`${API_BASE}/admin/flats`);
}

export async function uploadBankCsv(file: File): Promise<CsvUploadResultDto> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/admin/payments/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const err = await res.json();
      if (err.message) errorMsg = err.message;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function getReviewQueue(): Promise<PaymentDto[]> {
  return fetchJson<PaymentDto[]>(`${API_BASE}/admin/payments/review`);
}

export async function resolvePayment(
  paymentId: string,
  flatId: string,
  billId: string
): Promise<PaymentDto> {
  return fetchJson<PaymentDto>(`${API_BASE}/admin/payments/${paymentId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ flatId, billId }),
  });
}

export async function getAllComplaints(): Promise<ComplaintSummaryDto[]> {
  return fetchJson<ComplaintSummaryDto[]>(`${API_BASE}/admin/complaints`);
}

export async function updateComplaintStatus(
  complaintId: string,
  status: string
): Promise<ComplaintSummaryDto> {
  const res = await fetch(`${API_BASE}/admin/complaints/${complaintId}/status?status=${status}`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error(`Failed to update status (${res.status})`);
  return res.json();
}

export async function overrideComplaintCategory(
  complaintId: string,
  category: string
): Promise<ComplaintSummaryDto> {
  const res = await fetch(`${API_BASE}/admin/complaints/${complaintId}/category?category=${category}`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error(`Failed to update category (${res.status})`);
  return res.json();
}

