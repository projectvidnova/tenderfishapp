# Tenderfish — Phased Build Plan

## Overview

This document defines the complete implementation plan for Tenderfish, broken into 13 phases with clear dependencies, deliverables, and task-level detail. Each phase is self-contained and produces a working, testable increment.

### Dependency Graph

```
Phase 1 ─────────────────────────────────────────────────────┐
   │                                                          │
   ├── Phase 2 (Onboarding) ──┬── Phase 10 (Inbox/Notifs)    │
   │                           ├── Phase 11 (Settings)        │
   │                           │                              │
   ├── Phase 3 (AI Pipeline) ──┤                              │
   │                           │                              │
   └── Phase 2 + 3 ──► Phase 4 (Dashboard/Overview)          │
                           │                                   │
                           ├── Phase 5 (Phases/Schedule) ──┐  │
                           ├── Phase 6 (Gates/Approvals) ──┤  │
                           │       │                        │  │
                           │       ├── Phase 7 (Consult.)   │  │
                           │       └── Phase 9 (Reviews)    │  │
                           │                                │  │
                           └── Phase 8 (Docs/Risks/Delays)─┤  │
                                                            │  │
                           Phase 12 (RBAC/Audit/Polish) ◄───┘  │
                                    │                           │
                           Phase 13 (Cloud Deploy) ◄────────────┘
```

### Parallelization Opportunities

Phases **5, 6, 8, 10, 11** can run in **parallel** after Phase 4 is complete.
Phases **7** and **9** depend on Phase 6 (gate system).
Phase **13** infrastructure scaffolding can start alongside Phase 1.

---

## Phase 1 — Foundation & Infrastructure

**Goal:** Runnable monorepo with auth, database, design system, and empty shell app.

**Depends on:** Nothing (starting point)

### 1.1 Monorepo Scaffolding

Create the workspace structure:

```
tenderfish/
├── apps/
│   ├── web/           # Next.js 14 (App Router) + TypeScript + Tailwind + Framer Motion
│   └── api/           # Node.js + Fastify + TypeScript
├── packages/
│   └── shared/        # Shared types, constants, validation schemas
├── docker-compose.yml # Local dev: Postgres, Redis, api, web
├── .env.example
├── turbo.json         # Turborepo config
└── package.json       # Root workspace
```

- `apps/web`: Next.js 14 with App Router, TypeScript strict mode, Tailwind CSS, Framer Motion
- `apps/api`: Fastify with TypeScript, Drizzle ORM, structured route modules
- `packages/shared`: Shared TypeScript types for all entities, API request/response schemas, constants (gate criteria, HOAI phase definitions, role definitions)

### 1.2 Design System Tokens

Tailwind config with all application tokens from spec:

**Colors:**
| Token | Value | Usage |
|-------|-------|-------|
| `sidebar-bg` | `#0B0B0C` | Sidebar background |
| `sidebar-text` | `rgba(255,255,255,0.6)` | Sidebar inactive text |
| `sidebar-active` | `#FFFFFF` | Sidebar active text |
| `sidebar-border` | `#B7792E` | 2px left border on active item |
| `topbar-border` | `#DCD7CF` | Top bar bottom border |
| `page-bg` | `#F7F5F2` | Main content background |
| `card-bg` | `#FFFFFF` | Card backgrounds |
| `card-border` | `#DCD7CF` | Card borders |
| `bronze` | `#B7792E` | Primary action color |
| `confirmed-bg` | `#0D2B1A` | CONFIRMED chip bg |
| `confirmed-text` | `#3F7A5A` | CONFIRMED chip text/border |
| `derived-bg` | `#0D1B2A` | DERIVED chip bg |
| `derived-text` | `#4A637D` | DERIVED chip text/border |
| `unclear-bg` | `#2A1A08` | UNCLEAR chip bg |
| `unclear-text` | `#C47A2C` | UNCLEAR chip text/border |
| `missing-bg` | `#2A0D0D` | MISSING chip bg |
| `missing-text` | `#B04A3A` | MISSING chip text/border |
| `gate-complete` | `#3F7A5A` | Gate complete badge |
| `gate-progress` | `#B7792E` | Gate in-progress badge |
| `gate-locked-bg` | `#DCD7CF` | Gate locked badge bg |
| `gate-locked-text` | `#6B6B6B` | Gate locked badge text |
| `gate-overridden` | `#C47A2C` | Gate overridden badge |

**Typography:**
- UI elements: DM Sans (400, 500, 600, 700)
- Monospace data: JetBrains Mono (400, 500)

**Geometry:**
- Button border-radius: `0px` (sharp)
- Card border-radius: `4px`
- Input border-radius: `4px`

**Reusable UI components to build:**
- `DataStateChip` — renders CONFIRMED / DERIVED / UNCLEAR / MISSING with correct colors
- `GateBadge` — renders gate status (Complete / In Progress / Locked / Overridden)
- `HealthDot` — green / amber / red dot with tooltip
- `Button` — primary (Bronze bg), secondary (outline), destructive (red)
- `Card` — white bg, 1px border, 4px radius
- `Modal` — overlay with card content, close button
- `Table` — sortable, filterable data table

### 1.3 Database Schema

PostgreSQL 15 with Drizzle ORM. All tables include `workspace_id` for multi-tenant RLS.

**Core tables:**

```sql
-- Tenant isolation
workspaces (id, name, slug, plan, inbox_email, created_at)
users (id, workspace_id, email, name, role, created_at)

-- Project core
projects (id, workspace_id, name, type, status, gate_status_a_f, procurement_model, target_completion, health_score, created_at)
project_facts (id, project_id, field_name, value, data_state, source_ref, created_at)

-- Planning
phases (id, project_id, lph_1_9, status, start_date, end_date, objective)
tasks (id, project_id, phase_id, name, owner_user_id, reviewer_user_id, approver_user_id, due_date, status, dependencies[], evidence_ref)

-- Gate control
gates (id, project_id, gate_a_f, status, criteria_jsonb, override_active, override_reason, override_by, override_at)

-- Procurement & consultants
consultants (id, project_id, discipline, readiness_criteria_jsonb, invitation_status, invited_at, invited_by)
tender_packages (id, project_id, name, procurement_model, readiness_score, tender_ready, invitation_enabled, blockers_jsonb)

-- Documents & evidence
documents (id, project_id, name, type, versions_jsonb, current_version, status, created_by)
approvals (id, project_id, name, type, status, requested_by, approver_user_id, due_date, approved_at, notes)
delay_events (id, project_id, event_date, reported_by, description, cause_category, affected_tasks[], evidence_refs[], schedule_impact_days, status)
review_submissions (id, project_id, type, submitted_by, status, deviations_jsonb, reviewer_id, review_outcome)

-- Collaboration
invitations (id, project_id, user_id, role, gate_at_invitation, invited_by, status, accepted_at)
audit_logs (id, workspace_id, project_id, user_id, action, entity_type, entity_id, before_state_jsonb, after_state_jsonb, created_at)
inbox_messages (id, workspace_id, project_id_nullable, from_email, subject, body, attachments_jsonb, ai_suggestions_jsonb, status, created_at)
```

**Row-Level Security (RLS):**
- Every query is scoped by `workspace_id`
- RLS policies on every table: `USING (workspace_id = current_setting('app.workspace_id')::uuid)`
- No cross-workspace data ever returned

**Migrations:**
- Drizzle Kit for schema migrations
- Seed script for development (sample workspace, users, project)

### 1.4 Auth (Clerk)

- Clerk SDK integration in both `web` and `api`
- Signup flow: creates Clerk user + internal `users` + `workspaces` records
- Login: Clerk session → internal user lookup → `workspace_id` binding
- Google OAuth: "Continue with Google" option
- Webhook handlers: `POST /api/auth/...` for Clerk events (user.created, user.updated, session.created)
- Middleware: extract `workspace_id` from authenticated session, set on every API request context

### 1.5 Redis Setup

- Redis connection pool via `ioredis`
- Used for: session cache, job status polling, dashboard data cache, rate limiting
- Key patterns: `ws:{workspace_id}:dashboard`, `job:{job_id}:status`, `rate:{ip}:{endpoint}`

### 1.6 GCS Integration

- `@google-cloud/storage` SDK
- Upload utility: accepts file buffer + metadata → stores to `{workspace_id}/projects/{project_id}/documents/{doc_id}/v{n}/filename`
- Download utility: generates signed URLs (15-minute expiration) for file access
- Bucket per environment: `tenderfish-prod-files`, `tenderfish-staging-files`
- Max file size: 50MB per file
- Supported types validated server-side: PDF, DOCX, MSG, EML, TXT, XLSX, JPG, PNG

### 1.7 Docker & Local Dev

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15
    ports: ["5432:5432"]
    volumes: [pg_data:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: tenderfish
      POSTGRES_USER: tenderfish
      POSTGRES_PASSWORD: localdev

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api:
    build: ./apps/api
    ports: ["3001:3001"]
    depends_on: [postgres, redis]
    env_file: .env

  web:
    build: ./apps/web
    ports: ["3000:3000"]
    depends_on: [api]
    env_file: .env
```

### 1.8 App Shell Layout

```
┌─────────────────────────────────────────────────────────┐
│ TOP BAR (64px, white, 1px border-bottom #DCD7CF)        │
│ [Workspace name]           [Inbox badge] [User avatar]  │
├──────────┬──────────────────────────────────────────────┤
│ SIDEBAR  │ PAGE CONTENT                                  │
│ (240px)  │ (flex-grow, bg #F7F5F2, overflow-y: auto)     │
│ #0B0B0C  │                                              │
│          │                                              │
│ Nav:     │                                              │
│ Dashboard│                                              │
│ Projects │                                              │
│ Inbox    │                                              │
│ ──────── │                                              │
│ [project │                                              │
│  subnav] │                                              │
│ ──────── │                                              │
│ Settings │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**Sidebar nav items:**
- Top: Tenderfish logo (white)
- Main: Dashboard, Projects, Inbox (with unread badge)
- Project subnav (when inside a project): Overview, Phases (LPH), Schedule, Responsibilities, Approvals, Consultants, Procurement, Documents, Risks & Blockers, Delays, Reviews, Execution, Gate Control, Team & Invitations
- Bottom: Settings

**Active state:** White text, 2px left border Bronze `#B7792E`, slightly lighter bg
**Hover state:** White text at 100% opacity
**Mobile (< 768px):** Sidebar collapses to bottom tab bar with 4 tabs: Dashboard, Projects, Inbox, Profile

### Phase 1 Deliverable

> A logged-in user sees an empty dashboard with fully styled sidebar navigation. All database tables exist with RLS policies. File upload to GCS works. Local dev runs via docker-compose.

---

## Phase 2 — Onboarding & Workspace Setup

**Goal:** Complete signup-to-dashboard flow with team invitations.

**Depends on:** Phase 1

### 2.1 Signup Screen (`/signup`)

**Layout:** Split — left panel dark ink with tagline, right panel white form.

**Form fields:**
1. Full name — text, required
2. Work email — email, required, validated
3. Password — min 8 chars, strength indicator (weak / fair / strong)
4. Office / company name — text, required (becomes workspace name)
5. Country — dropdown, pre-selected "Germany"

**Submit logic:**
1. Create Clerk user account
2. Create internal `users` record
3. Create `workspaces` record with slug from office name
4. Generate inbox email: `{slug}@in.tenderfish.ai`
5. Send verification email
6. Redirect to `/onboarding/workspace`

**Additional UI:**
- "Already have an account? Log in" link → `/login`
- "Continue with Google" OAuth button

### 2.2 Login Screen (`/login`)

- Email + password fields
- "Forgot password?" link (Clerk-managed flow)
- "Continue with Google" OAuth button
- "No account? Sign up" link → `/signup`
- On success: redirect to `/dashboard`

### 2.3 Onboarding Wizard (`/onboarding/workspace`)

3-step wizard with progress bar ("Step N of 3").

**Step 1 — Office Profile**
- Workspace name (pre-filled from signup, editable)
- Office address (street, city, postcode, country)
- Tax ID (optional)
- Logo upload (optional, square image → GCS)
- `Continue →`

**Step 2 — Invite Your Team**
- Repeatable rows: email input + role dropdown (Project Lead / Team Member)
- "+ Add another" link for more rows
- "I'll do this later" skip link
- `Continue →`
- On submit: send invitation emails to all entered addresses

**Step 3 — Your Workspace Inbox**
- Display: "Your inbox address: `{slug}@in.tenderfish.ai`"
- Copy-to-clipboard button
- Instructions text explaining email forwarding
- Optional: "Your current office email" field → shows forwarding setup guide
- `Go to dashboard →` → `/dashboard`

### 2.4 Invitation System

- Invitation emails sent via Postmark
- Each invitation generates a unique tokenized link: `/invite/[token]`
- Token stored in `invitations` table with expiry (7 days)
- Accept flow: recipient signs up or logs in → added to workspace with specified role
- Resend and revoke actions available from Settings: Team

### 2.5 Workspace API

```
GET  /api/workspaces/me      → returns current workspace details
PATCH /api/workspaces/me     → update workspace (name, address, logo, etc.)
```

### Phase 2 Deliverable

> User can sign up, complete 3-step onboarding, invite teammates, and land on the dashboard. Teammates receive email invitations and can join the workspace.

---

## Phase 3 — AI Pipeline & Project Intake

**Goal:** Users can create a project from uploaded files with full AI extraction.

**Depends on:** Phase 1

### 3.1 Upload Screen (`/projects/new` — Step 1)

**Page title:** "New project"
**Subtitle:** "Start with whatever you have. Tenderfish will structure it."

**Upload zone:**
- Large dashed-border rectangle (full width, 200px height)
- Center text: "Drop files here, or click to browse"
- Subtitle: "PDF · DOCX · MSG · EML · TXT · XLSX · JPG · PNG"
- On drop/select: files listed below with filename, size, remove button
- Upload progress bar per file (chunked upload to GCS)

**Text alternative:**
- Expandable textarea: "Or paste a project briefing here"
- Placeholder: "Paste any briefing text, email content, or project notes..."

**Validation:** At least one file OR textarea with content required to enable "Next →".

### 3.2 File Parsing Service

Server-side parsing module for each supported type:

| Format | Library | Output |
|--------|---------|--------|
| PDF | `pdf-parse` | Raw text |
| DOCX | `mammoth` | Plain text |
| EML / MSG | `mailparser` | Body text + extracted attachments |
| Images (JPG/PNG) | Claude Vision API | Base64 → text description |
| TXT | Direct read | Raw text |
| XLSX | `xlsx` / `sheetjs` | Structured cell data |

All parsed text concatenated into a single input document for AI processing.

### 3.3 Quick Form (`/projects/new` — Step 2)

**Headline:** "Add context (optional but helpful)"

**All fields optional:**
- Project name — text, placeholder "e.g. Bürohaus Mitte"
- Project type — dropdown: New Build / Refurbishment / Conversion / Interior Fit-Out / Mixed Use / Not sure
- City / Location — text
- Client name — text
- Procurement model — dropdown: General Contractor / Single Trades / Unclear
- Target completion — date picker
- Known constraints — textarea

**"Analyse project →"** button (Bronze) → triggers AI pipeline → Step 3

### 3.4 AI Processing Pipeline

Triggered as an async Cloud Tasks job. Returns `job_id` immediately.

**Step 1 — File parsing** (see 3.2)

**Step 2 — Fact extraction** (Claude API call #1)
```
System prompt: Expert AI project analyst for German HOAI architectural projects.
Extract structured facts with data_state assignment.
Required fields: project_name, project_type, location, client_name,
  client_representative, decision_authority, scope_description,
  procurement_model, target_completion, known_deadlines[],
  known_consultants[], known_constraints[], mentioned_risks[],
  mentioned_approvals[], lph_start_estimate
Output: JSON { facts: [{ field, value, data_state, source_quote, confidence }] }
```

**Step 3 — Project classification** (Claude API call #2)
```
Classify project → JSON { type, delivery_model, planning_state,
  complexity_level, lph_current, lph_implied_start, special_flags[] }
```

**Step 4 — Gate eligibility check** (deterministic rule engine, NO AI)
- Gate A: project_name ≠ MISSING, location ≠ MISSING, client ≠ MISSING, ≥1 time anchor
- Gate B: project_objective ≠ MISSING, main_constraints identified, first_risk_scan completed
- Gates C–F: respective criteria checked

**Step 5 — Initial structure generation** (Claude API call #3)
```
Generate project operating model → JSON {
  lph_roadmap (phases 1–9 with dates, work packages per phase),
  responsibility_structure (roles per phase),
  approval_structure (approval types needed),
  consultant_readiness_requirements per discipline,
  risk_register (initial risks),
  missing_information_list
}
```

**Step 6 — Persist to database**
Single transaction: insert project, project_facts, phases, tasks, gates, consultants, approvals, risks.

**Step 7 — Return project ID**
Job status → complete. Frontend redirects to Step 4.

### 3.5 Processing Screen (`/projects/new` — Step 3)

Centered layout. Animated checklist:

```
Analysing your project material...

✓  Files received and parsed
✓  Running fact extraction
→  Classifying project type...
○  Mapping to HOAI LPH 1–9
○  Generating schedule model
○  Building responsibility structure
○  Running gate eligibility check
○  Generating dashboard configuration
```

- Steps advance as backend job progresses
- Poll `/api/jobs/[job_id]/status` every 2 seconds
- On complete: auto-redirect to Step 4
- On failure: error state + "Try again" button + support contact

### 3.6 Extraction Review (`/projects/new` — Step 4)

**Two-panel layout:**

**Left panel — Source files:**
- List of uploaded files with "view" preview link (modal viewer)

**Right panel — Extracted facts table:**
| Column | Behavior |
|--------|----------|
| Field | Label (e.g. "Project name") |
| Value | Editable inline — click to edit |
| Data State | Chip (CONFIRMED/DERIVED/UNCLEAR/MISSING) — click to override |
| Source | Source quote reference |

**Rows:** Project name, type, location, client, client representative, procurement model, LPH start, target completion, known deadlines, constraints, consultants, risks.

**Open questions section (collapsible):** All UNCLEAR and MISSING items. Each has a "Resolve" button → inline form.

**Gate A status preview:** Small card showing "Gate A (Project Intake): PASS / FAIL". If FAIL: shows missing criteria checklist.

**Actions:**
- "Create project" (Bronze) → persist all records → redirect to `/projects/[id]/overview`
- "← Back to edit" → return to Step 2

### 3.7 Project Creation API

```
POST /api/projects                      → create project record
POST /api/projects/:id/intake           → trigger AI pipeline, returns job_id
GET  /api/jobs/:jobId/status            → poll job status
GET  /api/projects/:id/facts            → get extracted facts
PATCH /api/projects/:id/facts/:factId   → update fact value or data_state
```

### Phase 3 Deliverable

> Full project creation flow: upload files → AI extracts facts → user reviews/corrects → project created with initial structure (phases, tasks, gates, risks, responsibilities).

---

## Phase 4 — Dashboard & Project Overview

**Goal:** Operational dashboard and project overview screen.

**Depends on:** Phases 2 and 3

### 4.1 Dashboard (`/dashboard`)

**Top bar:** "+ New Project" button (Bronze, right-aligned)

**Section 1 — Active Projects Pipeline**
- Horizontal scroll strip of project cards (200×140px, white, 1px border)
- Each card: project name (DM Sans 15px/500), LPH badge (JetBrains Mono), gate badge, health dot (green/amber/red), procurement chip, target completion date
- Click → `/projects/[id]/overview`

**Section 2 — Action Required**
- Table: Project · Item · Type · Due · Action button
- Types: Overdue Approval / Blocked Gate / Missing Info / Pending Invitation / Overdue Review
- Sorted by urgency (overdue first), max 10 rows + "View all" link
- Action button links directly to relevant screen

**Section 3 — Upcoming Milestones (next 30 days)**
- Table: Date · Project · Milestone · Phase · Owner · Status
- Sorted ascending by date, max 10 rows

**Section 4 — Blocked Projects**
- Cards for projects with actively blocked gates — shows which gate + top blocking criterion
- Empty state: "No blocked projects — good." (grey text)

**Polling:** Dashboard data refreshes every 60 seconds.

### 4.2 Health Score Engine

Server-side computation stored on `projects.health_score`:
- **Green:** No blockers, no overdue items
- **Amber:** Non-critical missing items (UNCLEAR facts, non-blocking gaps)
- **Red:** Gate blocked OR critical overdue approval

Recomputed on: task status change, approval status change, gate re-evaluation, blocker resolution.

### 4.3 Project Overview (`/projects/[id]/overview`)

**Project top bar (shown on all project pages):**
- Project name (inline editable — click to edit)
- LPH badge (e.g. "LPH 3")
- Gate badge (e.g. "Gate C → In Progress")
- Health dot with tooltip
- "⋮" menu: Edit project details / Archive / Export audit pack

**3-column layout:**

**Column 1 — Project Core**
Inline-editable fields (label above, value below, edit icon on hover):
- Project name, type, location, client, client representative
- Procurement model (dropdown)
- Project objective (textarea)
- Scope summary (textarea)
- Status: Active / On Hold / Archived (dropdown)

**Column 2 — Readiness Overview**
5 readiness progress bars (thin 4px, Bronze fill, grey bg):

| Readiness | Links to |
|-----------|----------|
| Planning Readiness | `/phases` |
| Consultant Readiness | `/consultants` |
| Tender Readiness | `/procurement` |
| Execution Readiness | `/execution` |
| Closeout Readiness | `/execution` (closeout tab) |

Percentage in JetBrains Mono 13px, right-aligned.

**Column 3 — Gate Status**
All 6 gates listed:
```
Gate A  ●  Complete      Project Intake Complete
Gate B  ●  Complete      Planning Ready
Gate C  ◐  In Progress   Consultant Invitation Ready
Gate D  ○  Locked        Tender Ready
Gate E  ○  Locked        Execution Ready
Gate F  ○  Locked        Closeout Ready
```
Click → scrolls to gate detail in `/projects/[id]/gates`

**Below columns — Action Strip**
Horizontal scroll of action cards (urgent items). Each: category chip, 1-line description, due date (red if overdue), "Resolve →" button.

### 4.4 Project API

```
GET   /api/projects              → list workspace projects
GET   /api/projects/:id          → project detail
PATCH /api/projects/:id          → update project
GET   /api/projects/:id/facts    → extracted facts
PATCH /api/projects/:id/facts/:factId → update fact
```

### Phase 4 Deliverable

> Dashboard shows all projects with live health scores, action items, milestones, and blocked projects. Project overview provides a complete at-a-glance view of any project.

---

## Phase 5 — Phases, Schedule & Responsibilities

**Goal:** Core project planning modules.

**Depends on:** Phase 4

### 5.1 Phases (`/projects/[id]/phases`)

**Horizontal phase navigator:** 9 tabs (LPH 1–9). Each: "LPH [N]" in JetBrains Mono + 2-word phase name + status dot.

**Phase detail (selected phase):**

**Header:**
- Phase number + name (e.g. "LPH 3 · Entwurfsplanung")
- Status badge
- Objective (2–3 sentences, HOAI LPH description)
- Date range: [start] → [end] with DERIVED chip if estimated

**5 tabs within each phase:**

| Tab | Content |
|-----|---------|
| Required Outputs | Table: name, description, status (Not Started/In Progress/Complete), owner, due date. Click → task detail modal |
| Work Packages | Expandable rows: name, phase, owner (assignable dropdown), reviewer, approver, due date, status, dependencies (linked tasks), evidence required (checkbox) |
| Required Decisions | Table: decision, decision maker, by when, status (Open/Decided/Overdue), notes |
| Required Documents | Table: document name, type, required for, status, upload button |
| Dependencies | Items from previous phase that must complete first. Red warning if incomplete + this phase is active |

**Behavior:**
- Autosave on blur with subtle "Saved" indicator
- Status changes trigger backend gate re-evaluation
- Phase cannot be "Complete" unless all required outputs are Complete

### 5.2 Schedule (`/projects/[id]/schedule`)

**View toggle (top right):** Gantt · Milestone List · Phase Summary

**Gantt view:**
- Rows: LPH phases (grouped) + key milestones + approval deadlines
- X-axis: monthly columns
- Phase bars: solid fill (confirmed dates), diagonal stripe (derived dates)
- Milestone diamonds: Bronze (confirmed), grey with "?" (derived)
- Critical path: red `#B04A3A` border on critical-path bars
- Today line: thin vertical Bronze line
- Hover tooltip: name, start, end, data state, owner, status

**Bar colors:**
| State | Color |
|-------|-------|
| On track | `#0D2B1A` (dark green) |
| At risk | `#2A1A08` (dark amber) |
| Overdue | `#2A0D0D` (dark red) |
| Future/derived | `#ECE8E1` with dashed border |

**Milestone List view:** Table: Date · Milestone · Phase · Owner · Data state chip · Gate link · Status

**DERIVED dates banner:** Yellow info bar when any dates are estimated.

**"+ Add milestone"** → modal: name, date, type (client decision / approval / phase gate / authority / handover), owner, related gate.

### 5.3 Responsibilities (`/projects/[id]/responsibilities`)

**RACI matrix table:**
- Rows: work packages and key tasks
- Column groups: Client team · Architect team · Consultants · Contractors
- Cells: R (Responsible) / A (Accountable) / C (Consulted) / I (Informed) / — (not involved)
- Click cell → dropdown to assign
- Unassigned R cells: light red `#FAF0EE` border highlight

**Filter bar:** Phase (All / LPH 1–9) · Role · Status (Assigned / Unassigned)
**Unassigned banner:** "N tasks have no responsible owner assigned."
**Export:** "Export as CSV" button

### 5.4 Phase/Task API

```
GET   /api/projects/:id/phases         → all phases
PATCH /api/projects/:id/phases/:lph    → update phase
GET   /api/projects/:id/tasks          → all tasks (filterable by phase)
POST  /api/projects/:id/tasks          → create task
PATCH /api/projects/:id/tasks/:taskId  → update task
```

### Phase 5 Deliverable

> Full project planning: 9-phase HOAI structure with work packages, Gantt chart with critical path, and RACI responsibility matrix.

---

## Phase 6 — Gate Control & Approvals

**Goal:** Gate progression system and approval workflows.

**Depends on:** Phase 4

### 6.1 Gate Control (`/projects/[id]/gates`)

**Layout:** Vertical stack of 6 expandable gate sections.

**Each gate section:**

**Header (always visible):**
- Gate letter + name + 1-line purpose
- Status badge: Complete / In Progress / Locked / Overridden
- Readiness percentage
- Expand/collapse chevron

**Expanded body:**
- Purpose statement (2 sentences)
- Criteria checklist: checkbox + criterion text + status chip + action link
  - Some criteria auto-checked by rule engine (e.g. "project name available")
  - Some require manual confirmation
- "Unlocks" section: features/invitations unlocked when gate is Complete

**Gate actions:**
- If all criteria met + status = In Progress → "Mark Gate [X] as Complete" → confirmation modal → logs completion
- "Override Gate" button (greyed for non-admins)

**Override flow (Architect Admin only):**
1. Modal: "You are overriding Gate [X]. This action is permanent and logged."
2. Reason textarea (min 50 characters)
3. Acknowledgment checkbox: "I confirm this override and accept responsibility"
4. "Confirm override" (Bronze)
5. Result: gate status → Overridden, audit log entry: user, timestamp, reason, consequences

**Override indicator banner:** "Overridden by [Name] on [Date] — [Reason]. All downstream consequences are in effect."

### 6.2 Gate Re-Evaluation Engine

Deterministic rule engine (no AI) that runs automatically on:
- Task status change
- Approval completion
- Document status change
- Blocker resolution
- Manual trigger

For each gate (A–F), evaluates all criteria against current project state. Updates:
- `gates.status`
- `gates.criteria` (JSONB with per-criterion pass/fail)
- Readiness percentage
- Dashboard health score

### 6.3 Approvals (`/projects/[id]/approvals`)

**8 type tabs:** Client · Internal · Technical · Material · Package Release · Tender Release · Execution Release · Closeout

**Table per tab:** Approval name · Phase · Gate · Requested by · Requested on · Approver · Due date · Status · Action

**Status chips:**
| Status | Style |
|--------|-------|
| Pending | Grey |
| In Review | Bronze |
| Approved | Green `#3F7A5A` |
| Rejected | Red `#B04A3A` |
| Overdue | Red background |

**Actions:**
- Pending → "Request approval" → modal: select approver, message, due date
- In Review → "Send reminder"
- Approved → "View record"

**Approval detail modal:**
- Name, type, related object
- Request history
- Review comments textarea
- Approve / Reject / Request clarification buttons with confirmation step
- Each action records: actor, timestamp, notes

**Rules:**
- Only designated approver or Architect Admin can approve/reject
- Approval/rejection triggers gate re-evaluation
- Overdue approvals appear in dashboard Action Required
- Email notification to approver on request; to requestor on decision

### 6.4 APIs

```
GET   /api/projects/:id/approvals                    → list approvals
POST  /api/projects/:id/approvals                    → create approval
PATCH /api/projects/:id/approvals/:approvalId        → approve/reject

GET   /api/projects/:id/gates                        → all gates
POST  /api/projects/:id/gates/:gate/complete         → mark complete
POST  /api/projects/:id/gates/:gate/override         → override (admin only)
```

### Phase 6 Deliverable

> Six gates with criteria checklists, auto-evaluation, admin override with audit trail. Full approval workflow with 8 types, role-based actions, and email notifications.

---

## Phase 7 — Consultants & Procurement

**Goal:** Consultant readiness and tender management.

**Depends on:** Phase 6 (gate system required for invitation control)

### 7.1 Consultants (`/projects/[id]/consultants`)

**One card per consultant discipline** (white, full-width, collapsible):

**Header:** Discipline name · readiness % (JetBrains Mono, Bronze) · status chip ("Invitation Ready ✓" green or "Not Ready — N criteria missing" amber)

**6-criteria readiness checklist:**
1. Clear scope description — status chip + edit link
2. Current project state visible — auto-derived
3. Expected outputs defined — status chip + add link
4. Required input documents available — status chip + manage link
5. Interfaces identified — status chip + edit link
6. Internal approval to invite — status chip + request approval button

**Invitation lock:** "Invite [discipline]" button is LOCKED (greyed, tooltip shows why) until all 6 criteria ✓ AND Gate C is open.

**Invitation modal (when unlocked):**
- Email address(es)
- Role: Consultant (pre-filled)
- Discipline (pre-filled)
- Optional message
- Access level: project-specific only
- Warning: "This person will see [shared modules]. They will NOT see [restricted modules]."
- "Send invitation" → logged to audit trail

**"+ Add consultant discipline"** → modal: discipline name, contact, company, email.

### 7.2 Procurement (`/projects/[id]/procurement`)

**Top:** Procurement model selector — "General Contractor" / "Single Trades" / "Unclear". Changes logged + notification.

**Package list (expandable rows):**
- Package name · procurement model chip · lead (assignable) · required docs count / uploaded · missing consultant inputs · open decisions · tender ready (YES/NO) · invitation enabled (YES/NO)

**Package detail (6 sections):**

| Section | Content |
|---------|---------|
| 1. Summary | Name, description, scope, model, lead, target tender date |
| 2. Required Documents | Checklist: name, status (Available/Missing/Outdated), upload button |
| 3. Open Decisions | Table: decision, owner, due date, status. Add button |
| 4. Missing Consultant Inputs | Table: discipline, required input, status. Links to consultant screen |
| 5. Tender Readiness | Gate D sub-criteria per package. Overall YES/NO |
| 6. Actions | "Issue to bidders" (LOCKED until tender ready + Gate D). "Add bidder" |

**Bid return tracking (post-invitation):**
Table: Bidder company · Invited · Return due · Status (Pending/Returned/Late/Withdrawn) · Action

**Award workflow:**
- Comparison view: bidders as columns, line items as rows
- Internal pricing hidden from bidder view
- Award button → confirmation → logs: user, timestamp, offer version
- Requires Architect Admin or Client Admin confirmation

### 7.3 APIs

```
GET   /api/projects/:id/consultants
POST  /api/projects/:id/consultants
PATCH /api/projects/:id/consultants/:consultantId

GET   /api/projects/:id/tender-packages
POST  /api/projects/:id/tender-packages
PATCH /api/projects/:id/tender-packages/:packageId
```

### Phase 7 Deliverable

> Consultant invitation gated by 6-criteria readiness + Gate C. Full tender package management with bid tracking and award workflow.

---

## Phase 8 — Documents, Risks & Delays

**Goal:** Document lifecycle, risk register, and structured delay tracking.

**Depends on:** Phase 4

### 8.1 Documents (`/projects/[id]/documents`)

**Layout:** Left tree (200px) + right content area.

**Left tree (collapsible groups):**
Project Briefs · Contracts · Planning Documents · Approval Documents · Tender Documents · Execution Documents · Meeting Records · Correspondence · Evidence

**Right panel — Document list table:**
Name · Type · Current version · Status chip · Last updated · Issued to · Actions (View/Download/New version)

**Document status chips:** Draft → Internally Reviewed → Approved for Issue → Issued → Superseded → Awarded Baseline → Archived

**Document detail modal:**
- Filename, type
- Version history: version number, date, uploaded by, status, changes note, download
- Current version + status chip
- Issued to list
- Approval record
- "Upload new version" → auto-increment version, prompt for change note
- "Mark as Superseded" → logs state change

**Upload new document:** Modal: file picker, document type dropdown, related phase (optional), related package (optional), initial status = Draft.

**Rules:**
- All versions stored in GCS: `{workspace_id}/projects/{project_id}/documents/{doc_id}/v{n}/filename`
- "Approved for Issue" requires Architect Admin or designated approver
- Gate-linked documents must be "Approved for Issue" for gate check to pass

### 8.2 Risks & Blockers (`/projects/[id]/risks`)

**Two tabs:** Risks | Blockers

**Risks tab:**
- "+ Add risk" button
- Table: name, category, probability (L/M/H), impact (L/M/H), risk score (colored square), owner, status, actions
- Categories: Missing Information · Deadline Risk · Coordination Risk · Approval Risk · Execution Risk · Communication Risk · Contract Interface Risk · External/Authority

**Risk detail modal:**
- Name, category, description
- Probability + impact dropdowns
- Owner (user assignment)
- Status: Open / Mitigated / Closed / Accepted
- Mitigation action (textarea)
- Evidence / linked documents
- History log

**Blockers tab:**
- Table: blocker description, blocked gate, blocked since, owner, downstream impact, next action, status
- Auto-generated from gate check engine + manually addable
- Status: Active / Resolved / Accepted as Risk
- Resolving a blocker triggers gate re-evaluation

### 8.3 Delays (`/projects/[id]/delays`)

**Warning banner:** "This module is a structured evidence and consequence tracker. It does not determine or record legal liability."

**"+ Log delay event"** → modal:
- Event date
- Reported by (user or free text)
- Description (textarea)
- Cause category dropdown: Client Delay · Missing Approval · Design Change · Missing Information · Consultant Delay · Contractor Delay · Site Condition · Authority Issue · Logistics Issue · Unknown
- Affected tasks (multi-select)
- Affected milestones (multi-select)
- Estimated schedule impact (working days)
- Initial responsibility (free text, not legal)
- Evidence upload
- Status: Open / Under Review / Resolved / Escalated

**Delay log table:** Date · Description · Cause · Affected milestones · Evidence · Impact days · Status · Owner · Actions

**Escalation flow:** Escalation button → modal: note + select recipient → notification + logged

**Delay summary panel:**
- Total events: N
- Total impact: N working days
- By cause category (CSS bar chart)
- By status

### 8.4 APIs

```
GET   /api/projects/:id/documents
POST  /api/projects/:id/documents
POST  /api/projects/:id/documents/:docId/versions

GET   /api/projects/:id/risks
POST  /api/projects/:id/risks
PATCH /api/projects/:id/risks/:riskId

GET   /api/projects/:id/delays
POST  /api/projects/:id/delays
PATCH /api/projects/:id/delays/:delayId
```

### Phase 8 Deliverable

> Full document versioning with role-gated status transitions. Risk register with scoring. Blocker tracking linked to gates. Structured delay logging with evidence and escalation.

---

## Phase 9 — Reviews & Execution

**Goal:** Shop drawing reviews and construction execution evidence tracking.

**Depends on:** Phase 6 (Gate E controls activation)

### 9.1 Reviews (`/projects/[id]/reviews`)

**Note bar:** "This workflow becomes active at Gate E (Execution Ready). Reviews can be set up in advance."

**6-column kanban board (drag-and-drop):**
Received → Completeness Check → Assigned → Under Review → Deviation Log → Closed

**Submission card:**
- Title · package name · contractor · submission date · reviewer · review due (red if overdue) · deviation count badge

**Submission detail (full modal):**

| Tab | Content |
|-----|---------|
| Documents | Uploaded drawings (inline PDF viewer), reference links, upload button |
| Deviation Log | Table: item no, description, severity (Minor/Major/Critical), design impact, technical impact, schedule impact, status, resolution notes. "+ Add deviation" |
| Review Record | Reviewer, date, outcome (Approved / Approved with Comments / Resubmission Required / Rejected), comments, "Submit review" button |

**Outcome rules:**
- Approved → Closed column, logged
- Resubmission Required → back to Received with flag
- Review triggers notification to submitting contractor

**"+ New submission"** → modal: package, contractor, drawing title, file upload, reference drawings, date.

### 9.2 Execution (`/projects/[id]/execution`)

**Warning banner:** "Execution evidence confirmation does not constitute formal acceptance, invoice approval, or commercial release."

**5 view toggle:** Submissions · Review Queue · Accepted · Punch List · Invoicing Ready

**Submissions table:** Date · Contractor · Package · Description · Completion % · Evidence · Status · Reviewer · Action

**Submission detail modal:**
- Package/trade, reported by, company, date, site area, scope item/drawing
- Photo gallery (full-size viewable)
- Text description, completion % (slider), quantity/measurement
- Attached files

**Review panel (architect-side):**
- Outcome: Accepted / Partially Accepted / Rejected / Rework Required / Moved to Punch List / Requires Clarification
- Comment (required), next action
- "Submit review" → logs: reviewer, date, outcome, comment, next action

**Punch List:** Table: item, from submission, package, contractor, status (Open/In Progress/Closed), target date, owner. Manual add + transfer from rejected submissions.

**Invoicing Ready:** Accepted items awaiting invoicing confirmation. "Confirm ready for invoicing" requires Architect Admin or Client Admin.

### 9.3 APIs

```
GET   /api/projects/:id/reviews
POST  /api/projects/:id/reviews
PATCH /api/projects/:id/reviews/:reviewId

GET   /api/projects/:id/execution
POST  /api/projects/:id/execution
PATCH /api/projects/:id/execution/:submissionId
```

### Phase 9 Deliverable

> Kanban-based shop drawing review with deviation tracking. Execution evidence workflow with photo evidence, punch lists, and invoicing-ready confirmation.

---

## Phase 10 — Inbox, Notifications & Team Management

**Goal:** AI-powered email inbox, notification system, and invitation control.

**Depends on:** Phase 2

### 10.1 Inbox (`/inbox`)

**Layout:** List panel (360px left) + detail panel (right).

**List panel:**
- Filter tabs: All · Unreviewed · Assigned · Archived
- Search bar
- Each item: from name/email, subject, date, attachment count, project match chip, unreviewed badge

**Detail panel:**
- From, To, Date, Subject
- Email body content
- Attachment list (download/preview)

**AI Analysis panel (distinct section):**
- Suggested project match: "[Project name] — [confidence %]" with "Assign" button
- Detected document type (e.g. "Offer / Tender Return")
- Detected signals as chips — ALL with "?" suffix and amber styling:
  - "Offer Received?" · "Approval Indicated?" · "Award Indicated?" · "Deadline Mentioned?"

**Actions:**
- "Assign to project" → dropdown of active projects
- "Create new project" → pre-populates project intake Step 2
- "Mark as [status]" → confirmation modal explaining consequence

**Archive button:** moves to Archived tab, no status change.

### 10.2 Postmark Inbound Webhook

`POST /api/webhooks/postmark-inbound`:
1. Receive incoming email (JSON payload)
2. Parse body + extract attachments
3. Run AI analysis (Claude): project match suggestion, document type, signals
4. Store to `inbox_messages` with `ai_suggestions` JSONB
5. Trigger "Inbox unreviewed" notification

### 10.3 Notification System

**Delivery:** In-app bell (badge count) + Postmark email

**10 event types:**

| Event | Trigger |
|-------|---------|
| Gate blocked | Gate re-evaluation finds previously passing criterion now failing |
| Approval overdue | Daily cron checks due dates |
| Approval requested | `approval.create` event |
| Consultant invitation ready | Readiness score reaches 100% first time |
| Tender package ready | `tender_ready` flips to true |
| Gate override | `gate.override` event → notifies all project Arch Admins |
| Review submission received | `review_submission.create` |
| Review overdue | Daily cron |
| Inbox unreviewed | `inbox_message.create` if not auto-assigned |

**Email template:** Plain text, minimal HTML, DM Sans, dark on white. Subject: "[Tenderfish] [Project name] — [Action required]"

**Cron jobs:** Cloud Scheduler runs daily checks for overdue approvals and overdue reviews.

### 10.4 Team & Invitations (`/projects/[id]/invitations`)

**Team tab:** Table: name, email, role, access level, joined, actions (change role / remove).

Roles: Architect Admin · Project Lead · Team Member · Client · Client Representative · Consultant · Reviewer · Approver · Document Controller · Bidder · General Contractor · Trade Contractor

**Invitation Control tab:**

Eligibility table: Role · Eligible · Controlling gate · Missing criteria · Can invite · Last check date

Row states:
- Eligible ✓ → "Invite" button active
- Not eligible → greyed, tooltip shows why
- Already invited → "Invited [date]" + status

**Invite action:**
1. Click "Invite" on eligible role
2. Modal: email(s), role (pre-filled), access scope, optional message
3. "Send invitation" → Postmark email with unique tokenized link `/invite/[token]`
4. Logged: inviting user, timestamp, gate at time, role

**Pending invitations:** Table: email, role, invited by, invited on, expires, status (Pending/Accepted/Expired), resend/revoke.

### 10.5 APIs

```
GET   /api/inbox                        → workspace inbox messages
PATCH /api/inbox/:messageId             → assign/mark status
POST  /api/webhooks/postmark-inbound    → incoming email webhook

GET   /api/projects/:id/invitations
POST  /api/projects/:id/invitations
DELETE /api/projects/:id/invitations/:invId
```

### Phase 10 Deliverable

> Working email inbox with AI triage (project matching, document detection, signal chips). Full notification system (in-app + email) for 10 event types. Gate-controlled invitation management per role.

---

## Phase 11 — Settings & Administration

**Goal:** All 8 settings sub-pages.

**Depends on:** Phase 2

### 11.1 Settings: Workspace

- Workspace name (editable), logo (upload/replace), address fields
- Workspace inbox address (read-only, copy button)
- Default country, default timezone
- "Save changes" button

### 11.2 Settings: Team

- Table: name, email, role, status (Active/Invited/Suspended), last active, actions
- Change role: dropdown → confirmation (Admin changes require another Admin)
- Remove from workspace: confirmation → user loses all workspace access
- Invite new member: email + role → invitation email

### 11.3 Settings: Notifications

Per-event toggles (Email ON/OFF · In-App ON/OFF) for all 10 event types.

### 11.4 Settings: Gate Rules

Per gate (A–F): dropdown → "Architect Admin only" or "Any Project Lead with reason". Default: Architect Admin only.

### 11.5 Settings: Integrations

- **GAEB exchange:** Status + configure button (upload GAEB file or endpoint)
- **Excel/CSV import:** Template download + import instructions
- **Workspace inbox:** Current address, project-specific alias option, forwarding guide
- **Future (greyed, "Coming Phase 2"):** Gmail · Outlook · Procore · DATEV

### 11.6 Settings: Audit Log

- Full workspace action history
- Filters: user, date range, action type, project
- Table: timestamp, user, role, action, entity, before/after state (expandable), project
- "Export audit log (CSV)" button

### 11.7 Settings: Billing

- Current plan, usage (projects N/N, users N/N)
- Next invoice date + amount
- Payment method (Stripe-managed)
- Invoice history table (date, amount, PDF download)
- Upgrade / Downgrade → plan comparison modal
- Cancel subscription → confirmation + retention period note

### 11.8 Settings: Data & Privacy

- "Export all workspace data" → GCS export job → email download link
- "Delete workspace" → two-step confirmation (type workspace name) → 30-day recovery window
- GDPR DPA: view/download PDF
- Data retention policy display
- Right to erasure request form

### Phase 11 Deliverable

> All 8 settings sub-pages fully functional: workspace config, team management, notification preferences, gate rule customization, integrations, audit log with export, Stripe billing, and GDPR-compliant data/privacy controls.

---

## Phase 12 — RBAC, Audit & Polish

**Goal:** Enforce access control across the entire app, complete audit logging, and production hardening.

**Depends on:** Phases 5–11

### 12.1 RBAC Enforcement

Middleware on every API endpoint enforcing the access matrix:

| Feature | Arch Admin | Proj Lead | Team Member | Client | Consultant | Bidder | Contractor |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Create project | ✓ | ✓ | — | — | — | — | — |
| View overview | ✓ | ✓ | ✓ | ✓ (limited) | ✓ (scoped) | — | — |
| Edit project facts | ✓ | ✓ | ✓ | — | — | — | — |
| Override gates | ✓ | — | — | — | — | — | — |
| Request approval | ✓ | ✓ | ✓ | — | — | — | — |
| Approve/reject | ✓ | ✓ (designated) | — | ✓ (client) | — | — | — |
| Invite consultants | ✓ | ✓ (Gate C+) | — | — | — | — | — |
| Invite bidders | ✓ | ✓ (Gate D+) | — | — | — | — | — |
| View tender docs | ✓ | ✓ | ✓ | ✓ (permitted) | ✓ (scoped) | ✓ (own pkg) | — |
| View internal pricing | ✓ | ✓ | ✓ | ✓ (permitted) | — | — | — |
| Submit bid | — | — | — | — | — | ✓ | — |
| Submit execution evidence | — | — | — | — | — | — | ✓ |
| Review execution | ✓ | ✓ | — | — | — | — | — |
| View audit log | ✓ | ✓ (project) | — | — | — | — | — |
| Export audit pack | ✓ | — | — | — | — | — | — |
| Manage workspace | ✓ | — | — | — | — | — | — |

### 12.2 Audit Trail

Every state-changing action writes to `audit_logs`:
- `before_state` and `after_state` JSONB snapshots
- Critical events with explicit logging: gate overrides, approval decisions, invitations, role changes, document status transitions, delay event creation, award decisions

### 12.3 Scoped Views

Role-specific view restrictions:
- **Client:** Limited overview (no internal pricing, no internal notes)
- **Consultant:** Only modules scoped to their discipline
- **Bidder:** Only their own package + tender documents
- **Contractor:** Only execution submission interface

### 12.4 Error Handling & Edge Cases

- Job failure states with retry + support contact
- File upload retries (3 attempts with exponential backoff)
- Optimistic UI with server-confirmed rollbacks
- Empty states for every screen (contextual guidance text)
- Session expiry handling (redirect to login, preserve intended destination)

### 12.5 Performance

- Redis caching: dashboard data, health scores, gate readiness
- Pagination on all list endpoints (cursor-based)
- GCS signed URLs for file access (15-minute expiration)
- Database query optimization: proper indexes on `workspace_id`, `project_id`, `status`, `due_date`
- Frontend: lazy loading for project sub-pages, image optimization

### Phase 12 Deliverable

> Production-grade access control for 7 roles across all endpoints. Complete audit trail with before/after snapshots. Scoped views per role. Error handling and performance optimization.

---

## Phase 13 — Cloud Deployment & CI/CD

**Goal:** Production infrastructure on Google Cloud.

**Depends on:** Phase 12 (can start scaffolding during Phase 1)

### 13.1 Cloud SQL

- PostgreSQL 15 instance
- Private IP, accessed via Cloud SQL Auth Proxy
- Automated backups (daily)
- Drizzle migrations on deploy

### 13.2 Cloud Run

3 containerized services:
- `api` — Fastify backend (auto-scaling: min 1, max 10)
- `web` — Next.js frontend (auto-scaling: min 1, max 10)
- `worker` — AI pipeline job processor (auto-scaling: min 0, max 5, 90s timeout)

### 13.3 Cloud Build CI/CD

Pipeline triggered on `main` branch push:
1. Run TypeScript checks + linting
2. Run automated tests
3. Build Docker images
4. Push to Artifact Registry
5. Deploy to Cloud Run (staging on `staging` branch, production on `main`)

### 13.4 Cloud Tasks + Scheduler

- **Cloud Tasks:** Async queue for AI processing pipeline jobs
- **Cloud Scheduler:** Daily cron for overdue notification checks (approvals, reviews)

### 13.5 Secret Manager

All secrets injected as environment variables at deploy time:

```
DATABASE_URL
REDIS_URL
ANTHROPIC_API_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
POSTMARK_API_KEY
POSTMARK_INBOUND_HASH
GCS_BUCKET_NAME
GCS_PROJECT_ID
```

### 13.6 Cloud Armor

- WAF in front of Cloud Run
- DDoS protection
- OWASP ruleset for common attack patterns

### 13.7 Environments

| Component | Staging | Production |
|-----------|---------|------------|
| Cloud SQL | `tenderfish-staging` | `tenderfish-prod` |
| GCS Bucket | `tenderfish-staging-files` | `tenderfish-prod-files` |
| Cloud Run | `api-staging`, `web-staging` | `api-prod`, `web-prod` |
| Secrets | Separate set per env | Separate set per env |
| Domain | `staging.tenderfish.ai` | `app.tenderfish.ai` |

### Phase 13 Deliverable

> Fully deployed, auto-scaling production infrastructure on Google Cloud with CI/CD, separate staging/production environments, WAF protection, and automated daily cron jobs.

---

## Complete API Reference

```
# Auth
POST   /api/auth/...                              Clerk webhook handlers

# Workspace
GET    /api/workspaces/me                          Current workspace
PATCH  /api/workspaces/me                          Update workspace

# Projects
GET    /api/projects                               List workspace projects
POST   /api/projects                               Create project
GET    /api/projects/:id                           Project detail
PATCH  /api/projects/:id                           Update project

# AI Pipeline
POST   /api/projects/:id/intake                    Trigger AI pipeline → job_id
GET    /api/jobs/:jobId/status                     Poll job status

# Facts
GET    /api/projects/:id/facts                     Extracted facts
PATCH  /api/projects/:id/facts/:factId             Update fact

# Phases & Tasks
GET    /api/projects/:id/phases                    All phases
PATCH  /api/projects/:id/phases/:lph               Update phase
GET    /api/projects/:id/tasks                     All tasks (filterable)
POST   /api/projects/:id/tasks                     Create task
PATCH  /api/projects/:id/tasks/:taskId             Update task

# Gates
GET    /api/projects/:id/gates                     All gates
POST   /api/projects/:id/gates/:gate/complete      Mark complete
POST   /api/projects/:id/gates/:gate/override      Override (admin only)

# Approvals
GET    /api/projects/:id/approvals                 List approvals
POST   /api/projects/:id/approvals                 Create approval
PATCH  /api/projects/:id/approvals/:approvalId     Approve/reject

# Consultants
GET    /api/projects/:id/consultants               List consultants
POST   /api/projects/:id/consultants               Add consultant
PATCH  /api/projects/:id/consultants/:consultantId Update consultant

# Tender Packages
GET    /api/projects/:id/tender-packages           List packages
POST   /api/projects/:id/tender-packages           Create package
PATCH  /api/projects/:id/tender-packages/:pkgId    Update package

# Documents
GET    /api/projects/:id/documents                 List documents
POST   /api/projects/:id/documents                 Upload document
POST   /api/projects/:id/documents/:docId/versions New version

# Delays
GET    /api/projects/:id/delays                    List delays
POST   /api/projects/:id/delays                    Log delay
PATCH  /api/projects/:id/delays/:delayId           Update delay

# Reviews
GET    /api/projects/:id/reviews                   List reviews
POST   /api/projects/:id/reviews                   Create review
PATCH  /api/projects/:id/reviews/:reviewId         Update review

# Invitations
GET    /api/projects/:id/invitations               List invitations
POST   /api/projects/:id/invitations               Send invitation
DELETE /api/projects/:id/invitations/:invId         Revoke

# Inbox
GET    /api/inbox                                  Workspace inbox
PATCH  /api/inbox/:messageId                       Assign/mark status
POST   /api/webhooks/postmark-inbound              Incoming email webhook

# Audit
GET    /api/projects/:id/audit-log                 Project audit log
GET    /api/workspaces/me/audit-log                Workspace audit log
```

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion |
| Backend | Node.js · Fastify · TypeScript |
| Database | PostgreSQL 15 · Drizzle ORM · Row-Level Security |
| Cache | Redis |
| Auth | Clerk (multi-tenant) |
| AI | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| File Storage | Google Cloud Storage |
| Email | Postmark (outbound + inbound webhooks) |
| Payments | Stripe |
| Hosting | Google Cloud Run (containerized, auto-scaling) |
| CI/CD | Cloud Build → Artifact Registry → Cloud Run |
| Async Jobs | Cloud Tasks |
| Cron | Cloud Scheduler |
| Security | Cloud Armor (WAF) · Secret Manager |
