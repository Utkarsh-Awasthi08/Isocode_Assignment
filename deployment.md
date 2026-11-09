# Deployment & Local Run Guide

## 1. How to Run Locally, Step by Step

You can run the full stack using Docker Compose (recommended) or as individual native services.

---

### Option A: Docker Compose (Recommended — 1 Command)

**Prerequisites:** Docker Desktop installed and running.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Utkarsh-Awasthi08/Isocode_Assignment.git
   cd Isocode_Assignment
   ```

2. **Create local environment file:**
   ```bash
   cp .env.example .env
   ```
   *(Optional: Add an LLM key if testing live AI classification. The emergency rule gate and manual fallback work without an API key).*

3. **Start all services:**
   ```bash
   docker-compose up --build
   ```

4. **Access the applications:**
   * **Frontend (Next.js):** [http://localhost:3000](http://localhost:3000)
   * **Backend API (Spring Boot):** [http://localhost:8080](http://localhost:8080)
   * **Database (PostgreSQL):** `localhost:5432`

---

### Option B: Native Local Development (Hot-Reloading)

**Prerequisites:** Java 17+, Maven 3.8+, Node.js 18+, Docker (for PostgreSQL).

1. **Start PostgreSQL only:**
   ```bash
   docker-compose up db -d
   ```

2. **Run Spring Boot Backend:**
   ```bash
   cd backend
   mvn spring-boot:run
   ```
   *Runs on port 8080. Flyway runs schema (`V1`) and seed data (`V2`) on startup automatically.*

3. **Run Next.js Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Runs on [http://localhost:3000](http://localhost:3000) with hot-reloading.*

---

## 2. Cloud Deployment & Environment Variables

The project deploys as a decoupled system:
* **Frontend:** Vercel (Next.js serverless / edge runtime)
* **Backend:** Render (Spring Boot web service via multi-stage `Dockerfile`)
* **Database:** Render (Managed PostgreSQL 16)

```
Browser ──> Vercel (Frontend) ──[/api/* rewrite]──> Render (Backend) ──> Render (PostgreSQL)
```

### Environment Variables (Names Only)

#### Backend Service (Render)

| Variable Name | Purpose |
|---|---|
| `DB_HOST` | Hostname of the PostgreSQL instance |
| `DB_PORT` | Port of the PostgreSQL instance |
| `DB_NAME` | Database name |
| `DB_USER` | Database username |
| `DB_PASS` | Database password |
| `SPRING_DATASOURCE_URL` | *(Alternative)* Full JDBC connection string |
| `SPRING_DATASOURCE_USERNAME` | *(Alternative)* Datasource user |
| `SPRING_DATASOURCE_PASSWORD` | *(Alternative)* Datasource password |
| `PORT` | Dynamic port injected by Render |
| `LLM_API_KEY` | API key for the chosen LLM provider (Gemini / OpenAI / Groq) |
| `LLM_BASE_URL` | Base URL for OpenAI-compatible endpoint |
| `LLM_MODEL` | Target model identifier |

#### Frontend Service (Vercel)

| Variable Name | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL of the deployed backend service (e.g. `https://<service>.onrender.com`) |

*Note: The frontend proxies all `/api/*` traffic via Next.js rewrites to `NEXT_PUBLIC_API_URL`, preventing browser cross-origin blocks.*

---

## 3. Demo Login Details for the Reviewer

The MVP implements role-based views without requiring SMS OTP infrastructure. Reviewers can switch between personas directly in the UI.

### Resident Portal (`/resident`)

Access by selecting a flat from the dropdown selector on the Resident page:

| Flat Number | Resident Name | Occupancy | Outstanding Due | Sample State to Test |
|---|---|---|---|---|
| **`T07-1203`** | Neeraj Kulkarni | Owner | ₹0.00 | Fully paid bill (₹7,475), 0 open complaints. |
| **`T12-0408`** | Swati Joshi | Tenant | ₹6,870.00 | Overdue by 47 days (₹6,370 base + ₹500 late fee), 1 open complaint (*water leak*). Click "Pay ₹6,870" for 1-tap mock payment test. |
| **`T21-1601`** | Aamir Shaikh | Owner | ₹5,860.00 | Partial payment state (₹10,660 base + ₹200 late fee, ₹5,000 previously paid), 18 days overdue. |

### Help-Desk & Accounts Console (`/admin`)

Access directly via the top navigation bar or navigate to `/admin`.

**Key features to review:**
1. **Collections & Dues Ageing:** KPI cards showing Total Billed, Total Collected, and Total Outstanding, paired with ageing buckets (`0–30 days`, `31–60 days`, `61+ days`).
2. **Reconciliation Engine:** Click the **"1-Click Test with Sample Statement"** button in the CSV workspace to test automated payment matching against the sample flats without needing external files.
3. **Manual Review Queue:** View payments with ambiguous amounts or missing references held for manual resolution. Click **Resolve** to bind a payment to a flat.
4. **Smart Complaints Hub:** View incoming complaints with their AI or safety-rule classification tags. Test 1-tap category override and status transitions (`Start Work`, `Resolve`, `Reopen`).
