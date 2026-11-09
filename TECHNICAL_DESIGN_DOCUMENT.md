# Technical Design Document: Township Facility Management MVP

## 1. Links
* **GitHub Repository URL:** [https://github.com/Utkarsh-Awasthi08/Isocode_Assignment.git](https://github.com/Utkarsh-Awasthi08/Isocode_Assignment.git)
* **Backend Target:** Render (Web Service + Managed PostgreSQL)
* **Frontend Target:** Vercel (Next.js Edge/Serverless)

---

## 2. Architecture and Rationale

The system uses a decoupled client-server architecture containerized with Docker.

```
Next.js 14 (App Router)  ──[/api/ reverse proxy]──>  Spring Boot 3.2 (Java 17)  ──>  PostgreSQL 16
        (Vercel)                                            (Render)                     (Render)
                                                               │
                                                               └──> LLM API (Gemini / OpenAI format)
```

### Stack Selection & Trade-offs

* **Backend: Java 17 & Spring Boot 3.2.5**
  * Financial reconciliation and billing cannot tolerate loose typing or silent runtime coercion. Spring Data JPA and Hibernate provide explicit entity lifecycle management, transactional boundaries (`@Transactional`), and schema validation.
  * Multi-step CSV reconciliation involves state transitions across bills, accounts, and payments. Java's static typing prevents calculation drift when handling currency (`BigDecimal`).

* **Frontend: Next.js 14 (App Router), React, Tailwind CSS**
  * The client specified a mobile-first resident experience and a desktop-first administrative dashboard. Next.js App Router allows clean separation of server and client components.
  * Server rewrites configured in `next.config.mjs` proxy API traffic to the backend, removing cross-origin complexity in production while keeping client code identical between local development and production.

* **Database: PostgreSQL 16**
  * Relational integrity is mandatory. A flat owns multiple bills; a bill receives zero or more payments; residents link to specific units. Foreign key constraints, unique billing month indexes, and numeric precision (`NUMERIC(10,2)`) protect financial records from corruption.
  * Flyway manages database migrations (`V1__init_schema.sql`, `V2__seed_data.sql`) to ensure schema parity across local Docker environments and production.

* **Containerization: Docker & Docker Compose**
  * Multi-stage builds produce minimal deployment artifacts: JRE-only base image for Spring Boot (~220MB) and standalone Node output for Next.js (~130MB).
  * Runs consistently on Apple Silicon (ARM64) and standard Linux servers (x86_64).

---

## 3. Data Model, Main Flows, and AI Integration

### Data Model

The schema centers on five core entities:

```
┌──────────────┐       1:N       ┌──────────────┐
│     Flat     │ ─────────────── │   Resident   │
└──────────────┘                 └──────────────┘
       │ 1:N                            
       ├────────────────────────────────┐
       ▼ 1:N                            ▼ 1:N
┌──────────────┐       1:N       ┌──────────────┐
│     Bill     │ ─────────────── │  Complaint   │
└──────────────┘                 └──────────────┘
       │ 1:N (via bill_id)
       ▼
┌──────────────┐
│   Payment    │
└──────────────┘
```

* **`Flat`**: Stores unit number (e.g., `T07-1203`), tower, square footage, and base maintenance rate (₹6.50/sq ft).
* **`Resident`**: Occupant record tied to a flat (`flat_id`). Stores contact details, occupancy status (Owner vs. Tenant), and active flag.
* **`Bill`**: Monthly maintenance liability per flat. Contains base charge (`area_sqft * rate`), late fee, amount paid, status (`UNPAID`, `PARTIAL`, `PAID`), and due date.
* **`Payment`**: Financial transaction record. Tracks amount, transaction date, reference/UTR number, UPI ID, source (`MOCK` vs. `CSV_IMPORT`), and reconciliation status (`MATCHED`, `REQUIRES_MANUAL_REVIEW`, `REJECTED`).
* **`Complaint`**: Service issue logged against a flat. Contains description, category, urgency, lifecycle status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `REOPENED`), assignment target, and root parent pointer (`duplicate_of`) for clustering duplicate reports.

---

### CSV Payment Reconciliation Engine

Manual entry into Tally currently wastes 60% of three accounts staff members' time. The matching engine in `PaymentMatchingService` automates reconciliation with a zero-leakage guarantee: ambiguous rows are never posted automatically.

```
                         Bank Statement CSV Row
                        (Date, Desc, Amount, Ref)
                                   │
                                   ▼
                    Load Open Candidate Bills Pool
                     (status IN [UNPAID, PARTIAL])
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
1. Reference Match Check                            2. Exact Amount Match Check
(Unit / Name / Last-4 Phone in Ref)                 (totalDue, remainingBase, or base)
         │                                                   │
         ├─────────────────┬─────────────────────────────────┤
         ▼                 ▼                                 ▼
Exactly 1 Ref Match   0 Ref Matches & 1 Amount Match    Multiple Amount Matches / No Ref
         │                 │                                 │
         ▼                 ▼                                 ▼
   STATUS: MATCHED   STATUS: MATCHED                  STATUS: REQUIRES_MANUAL_REVIEW
(Apply to Bill)   (Apply to Bill)                 (Route to Accounts Review Queue)
```

#### Step-by-Step Algorithm:

1. **Pre-processing:** Parse CSV input via OpenCSV. Strip UTF-8 BOM markers (`\uFEFF`) and normalize column headers (`AMOUNT`, `REFERENCE`, `UPI_ID`, `DATE`, `DESCRIPTION`) using alias lookups to support statement variants from different banks.
2. **Candidate Pool Generation:** Query all bills where `status != 'PAID'` with their associated flat and resident records.
3. **Identification Phase:**
   * **Signal A (Direct Reference / Occupant Identification):** Check if normalized flat tokens (e.g., `T12-0408` or `T12-408`), resident names, or phone suffixes match the transaction text or UPI ID.
   * **Signal B (Amount Matching):** Compare transaction amount against open balance configurations: full balance with late fees (`totalDue`), remaining base dues (`amount - amountPaid`), or original unpenalized bill amount.
4. **Resolution Logic:**
   * **Single Reference Match:** If reference text points clearly to one flat with an open bill, mark payment as `MATCHED`, credit the bill, update bill status (`PAID` or `PARTIAL`), and remove that bill from the in-memory pool so subsequent CSV rows cannot duplicate it.
   * **Single Unambiguous Amount Match:** If reference is blank or generic (e.g., `"Cash deposit"`) but only one flat in the entire township owes that exact sum, reconcile as `MATCHED`.
   * **Ambiguous / Colliding Match:** If two or more flats owe the exact amount and the reference is vague, flag as `REQUIRES_MANUAL_REVIEW` with an explanatory note (e.g., *"2 flats owe ₹6,370.00; reference unclear"*).
   * **No Candidate:** If amount matches no unpaid ledger, flag as `REQUIRES_MANUAL_REVIEW` (e.g., *"No pending bill found matching ₹5,000.00"*).
5. **Manual Review Resolution:** Help-desk staff review flagged entries in a dedicated UI queue and manually bind the unallocated payment to a verified flat and bill using `POST /api/admin/payments/{id}/resolve`.

---

### AI & Rules-Based Complaint Routing

The Township receives 1,800 complaints monthly, 25% of which are reopened due to misrouting. The complaint pipeline enforces safety first, then uses AI for triage:

```
                       Resident Complaint Text
                                  │
                                  ▼
                     [Step 1: Safety Keyword Gate]
              Contains: fire, gas, lift stuck, shock, flood?
                                  │
                  ┌───────────────┴───────────────┐
                 YES                              NO
                  ▼                               ▼
       Category: "Safety"             [Step 2: LLM Classification]
       Urgency:  "CRITICAL"           (Gemini / OpenAI API /chat/completions)
       Assignee: "Duty Manager"                   │
       Source:   "RULE_BASED"         ┌───────────┴───────────┐
       (Skip AI entirely)             ▼                       ▼
                                Success (JSON)         Timeout / Error
                                      │                       │
                                      ▼                       ▼
                           Category + Urgency      Category: "Uncategorized"
                           Assignee from Map       Urgency:  "MEDIUM"
                           Source: "AI"            Source:   "MANUAL"
                                      │                       │
                                      └───────────┬───────────┘
                                                  ▼
                                     [Step 3: Duplicate Linker]
                                  Same tower + category in 48h?
                                  If yes: set duplicate_of = parent
                                                  │
                                                  ▼
                                      Save to DB & Return DTO
```

1. **Safety Keyword Gate (Deterministic):**
   * Before initiating any external network call, `ComplaintService` checks lowercase complaint text against critical safety terms: `fire`, `gas`, `gas leak`, `lift stuck`, `shock`, `electric shock`, `flood`, `burning`, `smoke`, `explosion`, and multi-token phrases (`lift` + `stuck`).
   * If matched: classification instantly sets Category to `Safety`, Urgency to `CRITICAL`, Assignee to `Duty Manager`, and Source to `RULE_BASED`. The LLM is bypassed completely.

2. **LLM Classification (Probabilistic):**
   * If safety checks pass, `LlmService` executes an HTTP request to the configured model (`gemini-1.5-flash` via the OpenAI-compatible `/chat/completions` endpoint).
   * System instructions enforce valid JSON output containing `category`, `urgency`, and a 10-word `summary`.
   * Urgencies are constrained to `LOW`, `MEDIUM`, or `HIGH` (`CRITICAL` is restricted to rule-based safety events).
   * If the LLM is unreachable, unconfigured, or times out, the service falls back gracefully: assigns `Uncategorized` / `MEDIUM`, sets source to `MANUAL`, and routes to the help-desk queue without throwing an error.

3. **Duplicate Detection:**
   * Checks if an open issue with the same category exists in the same tower within the last 48 hours.
   * If found, the incoming complaint links its `duplicate_of` foreign key to the parent ticket. Duplicates are linked for visibility, never silently closed.

4. **1-Tap Admin Override:**
   * Help-desk operators can override misclassified categories in one click via `PATCH /api/admin/complaints/{id}/category`, updating the ticket's category, re-routing it to the correct department, and tagging the classification source as `MANUAL`.

---

## 4. UI and Design Decisions

The design follows the client's requirement for a restrained, minimal visual interface with clear purpose for every on-screen element.

### Visual System
* **Palette:** Strict monochrome foundation (slate-900 typography, neutral gray borders, white cards) with two functional accents: dark slate (`#0f172a`) for primary actions and emerald (`#059669`) for positive financial states. Warnings and critical alerts use controlled amber and red indicators.
* **Layout:** Generous whitespace, clean border dividers, and high-contrast typography instead of decorative graphics.

### Resident Application (Mobile-First)
* **Two-Tap Rule:** Residents open the application for seconds at a time. The home view surfaces what matters immediately: outstanding balance and active complaints.
  * *Tap 1:* Click "Pay ₹..." on any bill card to trigger the test payment modal.
  * *Tap 2:* Confirm payment. Bill updates immediately to `PAID` with receipt reference displayed.
* **Quick Complaint Submission:** A clean text area with pre-filled suggestions. Residents receive instant feedback showing whether the complaint was auto-assigned by AI or escalated to emergency teams.

### Help-Desk Dashboard (Desktop-First)
* **Collections & Dues Ageing KPIs:** Summary cards display Total Billed, Collected, Outstanding, and Review Queue items. An ageing table breaks unpaid receivables into `0–30 days`, `31–60 days`, and `61+ days` buckets.
* **CSV Reconciliation Workspace:** Features drag-and-drop file upload alongside a "1-Click Test with Sample Statement" button that loads sample bank statements instantly.
* **Review Queue Table:** Dedicated table highlighting unmatched rows, exact reasons for manual hold, and an inline resolution modal where staff pick the target flat and bill to reconcile payments.
* **Complaints Management Hub:** Live filter bar (`All`, `Critical`, `Open`, `In Progress`) with one-click status transitions (`Start Work`, `Resolve`, `Reopen`) and dropdown category overrides.

---

## 5. What Was Cut & Next Steps

### Scope Cuts (Deliberate MVP Boundaries)
To deliver the core requirements within 6 to 8 focused screens, the following non-core items were cut from this phase:
1. **Tally Accounting Sync:** Excluded bidirectional Tally ledger sync. The application handles maintenance receivables internally and outputs clean tabular summaries that accounts teams can export.
2. **Hardware Integrations:** Boom barriers, RFID tags, and automated gate camera hardware were omitted.
3. **Production RBAC & Phone OTP:** Replaced SMS OTP gateway integration with mock flat authentication (`?flatId=` query parameter and header support).
4. **Automated DPDP Act 90-Day Purge:** Retained database timestamps and schema provisions for visitor retention, but excluded the automated background cron job that physically purges media from disk storage.
5. **Multi-Language UI:** Localization keys for Marathi and Hindi were deferred to focus on core workflow stability in English.

### Next Engineering Steps
If work on this codebase continues into production hardening, the immediate priorities are:
1. **JWT & Mobile OTP Authentication:** Implement Spring Security with a Redis-backed OTP cache for phone verification, issuing short-lived JWT tokens tied to flat tenancy claims.
2. **Real-time Payment Webhooks:** Replace the mock payment endpoint with Razorpay / Cashfree webhook listeners to reconcile UPI collections via real-time gateway callbacks alongside the CSV statement parser.
3. **Scheduled DPDP Act Data Purge Worker:** Add a Spring `@Scheduled` background worker that executes nightly queries to delete visitor logs and photo blobs older than 90 days.
4. **Tally XML / CSV Ledger Exporter:** Provide accounts staff with a daily export endpoint generating Tally-compliant XML voucher definitions for reconciled payment batches.
5. **Offline Support for Gate Tablet Mode:** Add a Service Worker with IndexedDB caching so security guards can log visitor entries during township network outages and sync when connectivity returns.
