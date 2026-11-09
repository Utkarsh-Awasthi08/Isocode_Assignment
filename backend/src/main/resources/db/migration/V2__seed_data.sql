-- =====================
-- Seed Flats
-- =====================
INSERT INTO flats (id, flat_number, tower, area_sqft, rate_per_sqft) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'T07-1203', 'T07', 1150.00, 6.50),
  ('a1000000-0000-0000-0000-000000000002', 'T12-0408', 'T12',  980.00, 6.50),
  ('a1000000-0000-0000-0000-000000000003', 'T21-1601', 'T21', 1640.00, 6.50);

-- =====================
-- Seed Residents
-- =====================
INSERT INTO residents (id, flat_id, name, phone, is_tenant, is_active) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Neeraj Kulkarni', '9800000001', FALSE, TRUE),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'Swati Joshi',     '9800000002', TRUE,  TRUE),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'Aamir Shaikh',    '9800000003', FALSE, TRUE);

-- =====================
-- Seed Bills
-- Bill = area_sqft * rate_per_sqft
-- T07-1203: 1150 * 6.50 = 7475  → PAID
-- T12-0408:  980 * 6.50 = 6370  → UNPAID (47 days overdue, late fee applied)
-- T21-1601: 1640 * 6.50 = 10660 → PARTIAL (₹5000 paid, 18 days overdue)
-- Billing month = 2024-09-01, due_date = 2024-09-15
-- =====================
INSERT INTO bills (id, flat_id, billing_month, amount, late_fee, amount_paid, status, due_date) VALUES
  (
    'c1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    '2024-09-01', 7475.00, 0.00, 7475.00, 'PAID',
    '2024-09-15'
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000002',
    '2024-09-01', 6370.00, 500.00, 0.00, 'UNPAID',
    '2024-09-15'
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000003',
    '2024-09-01', 10660.00, 200.00, 5000.00, 'PARTIAL',
    '2024-09-15'
  );

-- =====================
-- Seed Complaints
-- T12-0408 has 1 open complaint: water leak
-- =====================
INSERT INTO complaints (id, flat_id, description, category, urgency, status, assigned_to, classification_source) VALUES
  (
    'd1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002',
    'Water leaking from bathroom ceiling, dripping continuously.',
    'Plumbing',
    'HIGH',
    'OPEN',
    'Helpdesk Team',
    'AI'
  );
