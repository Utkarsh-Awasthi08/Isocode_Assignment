-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================
-- FLATS
-- =====================
CREATE TABLE flats (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    flat_number     VARCHAR(20) NOT NULL UNIQUE,
    tower           VARCHAR(10) NOT NULL,
    area_sqft       NUMERIC(8,2) NOT NULL,
    rate_per_sqft   NUMERIC(6,2) NOT NULL DEFAULT 6.50,
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- =====================
-- RESIDENTS
-- =====================
CREATE TABLE residents (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    flat_id     UUID        NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(15),
    email       VARCHAR(100),
    is_tenant   BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- =====================
-- BILLS
-- =====================
CREATE TABLE bills (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    flat_id         UUID        NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
    billing_month   DATE        NOT NULL,
    amount          NUMERIC(10,2) NOT NULL,
    late_fee        NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    amount_paid     NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status          VARCHAR(20) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID')),
    due_date        DATE        NOT NULL,
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE(flat_id, billing_month)
);

-- =====================
-- PAYMENTS
-- =====================
CREATE TABLE payments (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    flat_id             UUID        REFERENCES flats(id) ON DELETE SET NULL,
    bill_id             UUID        REFERENCES bills(id) ON DELETE SET NULL,
    amount              NUMERIC(10,2) NOT NULL,
    reference           VARCHAR(100),
    upi_id              VARCHAR(100),
    description         TEXT,
    transaction_date    DATE        NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'REQUIRES_MANUAL_REVIEW' CHECK (status IN ('MATCHED', 'REQUIRES_MANUAL_REVIEW', 'REJECTED')),
    source              VARCHAR(20) NOT NULL DEFAULT 'CSV_IMPORT' CHECK (source IN ('MOCK', 'CSV_IMPORT')),
    review_note         TEXT,
    created_at          TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- =====================
-- COMPLAINTS
-- =====================
CREATE TABLE complaints (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    flat_id                 UUID        NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
    description             TEXT        NOT NULL,
    category                VARCHAR(50),
    urgency                 VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status                  VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REOPENED')),
    assigned_to             VARCHAR(100),
    classification_source   VARCHAR(20) NOT NULL DEFAULT 'AI' CHECK (classification_source IN ('RULE_BASED', 'AI', 'MANUAL')),
    duplicate_of            UUID        REFERENCES complaints(id) ON DELETE SET NULL,
    created_at              TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP   NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMP,
    rating                  SMALLINT    CHECK (rating BETWEEN 1 AND 5)
);

-- Indexes for common lookups
CREATE INDEX idx_bills_flat_id       ON bills(flat_id);
CREATE INDEX idx_bills_status        ON bills(status);
CREATE INDEX idx_payments_status     ON payments(status);
CREATE INDEX idx_complaints_flat_id  ON complaints(flat_id);
CREATE INDEX idx_complaints_status   ON complaints(status);
