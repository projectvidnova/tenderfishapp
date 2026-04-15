# Tenderfish — Application Specification
## Full UX Flow · Complete Functionality · GitHub Copilot Implementation Guide

---

## TECH STACK

- **Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion
- **Backend:** Node.js · Fastify · PostgreSQL · Redis · Drizzle ORM
- **Auth:** Clerk (multi-tenant workspace support)
- **AI:** Anthropic Claude API (`claude-sonnet-4-20250514`) — all AI processing
- **File storage:** Google Cloud Storage
- **Email inbox:** Postmark Inbound Webhooks
- **Hosting:** Google Cloud Run (containerized, auto-scaling)
- **Database:** Cloud SQL (PostgreSQL 15)
- **Deployment:** Cloud Build + Cloud Run, one service per environment (staging/prod)

---

## DESIGN SYSTEM (app-level)

Colors match homepage spec. Additional app-specific tokens:
- Sidebar background: `#0B0B0C`
- Sidebar text: `rgba(255,255,255,0.6)`
- Sidebar active: White + left border 2px Bronze `#B7792E`
- Top bar: White, 1px border-bottom `#DCD7CF`
- Page background: `#F7F5F2`
- Card background: `#FFFFFF` with 1px border `#DCD7CF`
- Data state chips — inline everywhere:
  - CONFIRMED: `#0D2B1A` bg · `#3F7A5A` text/border
  - DERIVED: `#0D1B2A` bg · `#4A637D` text/border
  - UNCLEAR: `#2A1A08` bg · `#C47A2C` text/border
  - MISSING: `#2A0D0D` bg · `#B04A3A` text/border
- Gate status badges:
  - Complete: Green `#3F7A5A`
  - In Progress: Bronze `#B7792E`
  - Locked: Grey `#DCD7CF` text `#6B6B6B`
  - Overridden: Orange `#C47A2C` with asterisk

Typography: Same as homepage. UI elements: DM Sans. Monospace data: JetBrains Mono.
Button radius: 0px (sharp). Card radius: 4px. Input radius: 4px.

---

## MULTI-TENANCY MODEL

Every database table has a `workspace_id` column. PostgreSQL row-level security (RLS) policies enforce tenant isolation. No cross-workspace data is ever returned.

Each workspace has:
- Isolated user list
- Isolated project list
- Isolated document storage bucket path
- Unique workspace inbox email: `{workspace-slug}@in.tenderfish.ai`
- Isolated audit log

---

## DATABASE SCHEMA (core tables)

```sql
workspaces: id, name, slug, plan, inbox_email, created_at
users: id, workspace_id, email, name, role, created_at
projects: id, workspace_id, name, type, status, gate_status(A-F), procurement_model, target_completion, health_score, created_at
project_facts: id, project_id, field_name, value, data_state(CONFIRMED|DERIVED|UNCLEAR|MISSING), source_ref, created_at
phases: id, project_id, lph(1-9), status, start_date, end_date, objective
tasks: id, project_id, phase_id, name, owner_user_id, reviewer_user_id, approver_user_id, due_date, status, dependencies[], evidence_ref
gates: id, project_id, gate(A-F), status, criteria(jsonb), override_active, override_reason, override_by, override_at
consultants: id, project_id, discipline, readiness_criteria(jsonb), invitation_status, invited_at, invited_by
tender_packages: id, project_id, name, procurement_model, readiness_score, tender_ready, invitation_enabled, blockers(jsonb)
documents: id, project_id, name, type, versions(jsonb), current_version, status, created_by
approvals: id, project_id, name, type, status, requested_by, approver_user_id, due_date, approved_at, notes
delay_events: id, project_id, event_date, reported_by, description, cause_category, affected_tasks[], evidence_refs[], schedule_impact_days, status
review_submissions: id, project_id, type(SHOP_DRAWING|EXECUTION_EVIDENCE), submitted_by, status, deviations(jsonb), reviewer_id, review_outcome
invitations: id, project_id, user_id, role, gate_at_invitation, invited_by, status, accepted_at
audit_logs: id, workspace_id, project_id, user_id, action, entity_type, entity_id, before_state(jsonb), after_state(jsonb), created_at
inbox_messages: id, workspace_id, project_id(nullable), from_email, subject, body, attachments(jsonb), ai_suggestions(jsonb), status, created_at
```

---

## AI PROCESSING PIPELINE

Used at project creation and whenever new material is uploaded.

### Step 1 — File parsing
- PDF: `pdf-parse` npm package → extract raw text
- DOCX: `mammoth` npm package → extract text
- Email (.eml / .msg): `mailparser` npm package → extract body + attachments
- Images: Pass as base64 to Claude with vision

### Step 2 — Fact extraction prompt (Claude API call)
```
System: You are an expert AI project analyst for German architectural projects under HOAI.
Extract structured facts from the input material.
For each fact, assign a data_state: CONFIRMED (explicitly stated), DERIVED (logically inferred), UNCLEAR (ambiguous or contradictory), MISSING (required but absent).
Return ONLY valid JSON. No preamble. No markdown.
Schema: { facts: [ { field, value, data_state, source_quote, confidence } ] }
Required fields to extract: project_name, project_type, location, client_name, client_representative, decision_authority, scope_description, procurement_model, target_completion, known_deadlines[], known_consultants[], known_constraints[], mentioned_risks[], mentioned_approvals[], lph_start_estimate }
```

### Step 3 — Project classification (second Claude API call)
```
System: Classify this architectural project. Return ONLY valid JSON.
Schema: { type: string, delivery_model: string, planning_state: string, complexity_level: string, lph_current: number, lph_implied_start: number, special_flags: string[] }
```

### Step 4 — Gate eligibility check (deterministic rule engine, no AI)
Run structured checks against extracted facts to determine which gates are passable:
- Gate A requires: project_name ≠ MISSING, location ≠ MISSING, client ≠ MISSING, at least one time anchor
- Gate B requires: project_objective ≠ MISSING, main_constraints identified, first_risk_scan completed
- etc.

### Step 5 — Initial structure generation (third Claude API call)
```
System: Generate the initial project operating model for a German HOAI architectural project.
Given the extracted facts and classification, generate:
- LPH roadmap (phases 1-9 with estimated dates, work packages per phase)
- Responsibility structure (roles per phase)
- Approval structure (approval types needed)
- Consultant readiness requirements per discipline
- Risk register (initial risks from facts)
- Missing information list
Return ONLY valid JSON matching the ProjectStructure schema.
```

### Step 6 — Store all results to PostgreSQL
Persist project, facts, phases, tasks, gates, consultants, approvals, risks in a single transaction.

### Step 7 — Return structured project ID to frontend
Frontend redirects to `/projects/[id]/overview`.

---

## APPLICATION LAYOUT

### Shell layout (rendered on every authenticated page)

```
┌─────────────────────────────────────────────────────────┐
│ TOP BAR (64px height, white, 1px border-bottom)         │
│ [Workspace name]           [Inbox badge] [User avatar]  │
├──────────┬──────────────────────────────────────────────┤
│ SIDEBAR  │ PAGE CONTENT                                  │
│ (240px)  │ (flex-grow, background #F7F5F2, scroll)       │
│ #0B0B0C  │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### Sidebar items (always visible):
```
[Tenderfish logo — white]
──────────────────────
Dashboard
Projects
Inbox  [badge: unread count]
──────────────────────
[ACTIVE PROJECT — shown when inside a project]
  > Overview
  > Phases (LPH)
  > Schedule
  > Responsibilities
  > Approvals
  > Consultants
  > Procurement
  > Documents
  > Risks & Blockers
  > Delays
  > Reviews
  > Execution
  > Gate Control
  > Team & Invitations
──────────────────────
Settings
```

Sidebar active state: white text, 2px left border Bronze `#B7792E`, slightly lighter background.
Sidebar hover: white text opacity 100%.
Mobile: Sidebar collapses to bottom tab bar with 4 tabs (Dashboard, Projects, Inbox, Profile).

---

## SCREEN-BY-SCREEN SPECIFICATION

---

### SCREEN: /signup

**Purpose:** Create new account (Architect Admin role by default).

**Layout:** Split — left panel dark ink with tagline, right panel white form.

**Form fields:**
1. Full name — text input, required
2. Work email — email input, required, validated
3. Password — password input, min 8 chars, strength indicator (weak/fair/strong)
4. Office / company name — text input, required (becomes workspace name)
5. Country — dropdown, pre-selected Germany

**On submit:**
- Create user record
- Create workspace record, generate workspace slug from office name
- Generate workspace inbox email: `{slug}@in.tenderfish.ai`
- Send verification email
- Redirect to `/onboarding/workspace`

**Also on page:**
- "Already have an account? Log in" → `/login`
- Google OAuth option: "Continue with Google"

---

### SCREEN: /login

**Fields:** Email + Password. "Forgot password" link. Google OAuth. Link to signup.
**On success:** Redirect to `/dashboard`

---

### SCREEN: /onboarding/workspace

**3-step wizard. Progress bar at top (Step 1 of 3 / 2 of 3 / 3 of 3).**

**Step 1 — Office profile**
- Workspace name (pre-filled from signup, editable)
- Office address (street, city, postcode, country)
- Tax ID (optional)
- Logo upload (optional, square image, stored to GCS)
- `Continue →`

**Step 2 — Invite your team**
- Repeatable email + role row (role options: Project Lead, Team Member)
- "Add another" link to add more rows
- "I'll do this later" skip link
- `Continue →`
- On submit: Send invitation emails to entered addresses

**Step 3 — Your workspace inbox**
- Display: `Your inbox address: {slug}@in.tenderfish.ai`
- Copy button next to address
- Instructions: "Forward project emails to this address, or share it with your team. Tenderfish will automatically read incoming emails, extract attachments, and suggest project matches."
- Optional field: "Your current office email (for forwarding instructions)" — shows a setup guide on submit
- `Go to dashboard →` → `/dashboard`

---

### SCREEN: /dashboard

**Top bar additions:** "+ New Project" button (Bronze) — right aligned

**Page sections in order:**

**1. Active Projects Pipeline**
Horizontal scroll strip of project cards. Each card (200px × 140px, white, 1px border):
- Project name (DM Sans 15px, 500 weight)
- LPH badge (JetBrains Mono, e.g. "LPH 3")
- Gate badge (e.g. "Gate C →")
- Health dot: Green (on track) / Amber (at risk) / Red (blocked)
- Procurement model chip
- Target completion date
- Click → `/projects/[id]/overview`

**2. Action Required**
Table with columns: Project · Item · Type · Due · Action button
Types: Overdue Approval · Blocked Gate · Missing Info · Pending Invitation · Overdue Review
Sorted by urgency (overdue first). Max 10 rows, "View all" link.
Each row: Action button links directly to the relevant screen and scrolls to the item.

**3. Upcoming Milestones (next 30 days)**
Table: Date · Project · Milestone · Phase · Owner · Status
Sorted ascending by date. Max 10 rows.

**4. Blocked Projects**
Cards showing projects where a gate is actively blocked — which gate, top blocking criterion.
Empty state: "No blocked projects — good." in grey.

**Functionality notes:**
- Dashboard data is live (polling every 60s or websocket push)
- Health scores computed server-side: Green = no blockers, no overdue; Amber = non-critical missing items; Red = gate blocked or critical overdue approval
- "+ New Project" button creates a new project intake session at `/projects/new`

---

### SCREEN: /projects/new — Step 1 (Upload)

**Page title:** "New project"
**Subtitle:** "Start with whatever you have. Tenderfish will structure it."

**Upload zone:**
- Large dashed rectangle (full content width, 200px height)
- Center text: "Drop files here, or click to browse"
- Subtitle: "PDF · DOCX · MSG · EML · TXT · XLSX · JPG · PNG"
- On file drop/select: files appear as a list below the zone with filename, size, remove button
- Progress bar per file during upload to GCS

**Text alternative:**
- Expandable textarea below upload zone: "Or paste a project briefing here"
- Placeholder: "Paste any briefing text, email content, or project notes..."

**Validation:** At least one file OR textarea has content to enable "Next →" button.

**"Next →"** → Step 2

---

### SCREEN: /projects/new — Step 2 (Quick form)

**Headline:** "Add context (optional but helpful)"
**Subhead:** "The more context you provide, the more accurate the initial structure."

**Fields (all optional):**
- Project name — text, placeholder "e.g. Bürohaus Mitte"
- Project type — dropdown: New Build · Refurbishment · Conversion · Interior Fit-Out · Mixed Use · Not sure
- City / Location — text
- Client name — text
- Procurement model — dropdown: General Contractor · Single Trades · Unclear
- Target completion — date picker
- Known constraints — textarea, placeholder "Any known planning restrictions, fixed deadlines, authority requirements..."

**"Analyse project →"** button (Bronze) → triggers AI pipeline → Step 3

---

### SCREEN: /projects/new — Step 3 (Processing)

**Layout:** Centered, no sidebar active project.

**Animated processing display:**
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

Each step completes with a checkmark. Steps are polled from the backend job status endpoint every 2 seconds.

Backend: Long-running job (Cloud Run, up to 90s). Returns job_id immediately on Step 2 submit. Frontend polls `/api/jobs/[job_id]/status`.

On job complete: Auto-redirect to Step 4.
On job failure: Show error state with "Try again" button and option to contact support.

---

### SCREEN: /projects/new — Step 4 (Extraction review)

**Headline:** "Review what we found"
**Subhead:** "Confirm, correct, or add to the extracted information before creating the project."

**Two panels side by side:**

**Left — Source files:**
- List of uploaded files
- Small "view" link to preview each file in a modal

**Right — Extracted facts table:**
Columns: Field · Value · Data State (chip) · Source

Rows (all editable inline — click value to edit, click data state chip to override):
- Project name
- Project type
- Location
- Client
- Client representative
- Procurement model
- LPH start (estimated)
- Target completion
- Known deadlines (list)
- Known constraints (list)
- Known consultants (list)
- Known risks (list)

Below table:
**Open questions (collapsible section):** Lists all UNCLEAR and MISSING items with a "Resolve" button that opens an inline form to enter the missing info.

**Gate A status preview:**
Small card: "Gate A (Project Intake): [PASS / FAIL]"
If FAIL: shows which criteria are missing as a checklist.

**Two action buttons:**
- "Create project" (Bronze) — creates all database records, redirects to `/projects/[id]/overview`
- "← Back to edit" — returns to Step 2

---

### SCREEN: /projects/[id]/overview

**Top bar for this project:**
- Project name (editable inline — click to edit)
- LPH badge (e.g. "LPH 3")
- Gate badge (e.g. "Gate C → In Progress")
- Health dot with tooltip
- "⋮" menu: Edit project details · Archive · Export audit pack

**3-column layout:**

**Column 1 — Project core:**
Fields (label above, value below, edit icon on hover):
- Project name
- Project type
- Location
- Client
- Client representative
- Procurement model (dropdown inline)
- Project objective (textarea inline)
- Scope summary (textarea inline)
- Status: Active / On Hold / Archived (dropdown)

**Column 2 — Readiness overview:**
5 readiness progress bars, each with label, percentage, and click-through to the detail screen:
- Planning Readiness → `/phases`
- Consultant Readiness → `/consultants`
- Tender Readiness → `/procurement`
- Execution Readiness → `/execution`
- Closeout Readiness → `/execution` (closeout tab)

Each bar: thin 4px height, Bronze fill `#B7792E`, grey background `#DCD7CF`. Percentage in JetBrains Mono 13px right-aligned.

**Column 3 — Gate status:**
List of all 6 gates:
```
Gate A  ●  Complete      Project Intake Complete
Gate B  ●  Complete      Planning Ready
Gate C  ◐  In Progress   Consultant Invitation Ready (2 criteria missing)
Gate D  ○  Locked        Tender Ready
Gate E  ○  Locked        Execution Ready
Gate F  ○  Locked        Closeout Ready
```
Each gate row: click → scrolls to gate detail in `/projects/[id]/gates`

**Below 3 columns — Action strip:**
Horizontal scroll of action cards (urgent items requiring attention). Each card:
- Category chip (Approval / Gate / Missing Info / Invitation / Review)
- 1-line description
- Due date (red if overdue)
- "Resolve →" button

---

### SCREEN: /projects/[id]/phases

**Top:** Horizontal phase navigator strip.
9 phase tabs. Each tab shows:
- "LPH [N]" in JetBrains Mono
- 2-word phase name in DM Sans
- Status dot (complete/active/future)
Click any tab to switch phase view.

**Main area — Selected phase detail:**

**Phase header:**
- Phase number + name (e.g. "LPH 3 · Entwurfsplanung")
- Status badge
- Phase objective (text block, 2–3 sentences describing HOAI LPH objective)
- Date range: [start date] → [end date] (with DERIVED chip if estimated)

**Tabbed content within each phase:**

Tab 1 — Required Outputs
Table: Output name · Description · Status (Not Started / In Progress / Complete) · Owner · Due date
Each row: click → opens task detail modal

Tab 2 — Work Packages
List of work packages. Each expandable row:
- Work package name
- Phase
- Owner user (assignable via dropdown)
- Reviewer (assignable)
- Approver (assignable)
- Due date (date picker)
- Status
- Dependencies (linked to other tasks)
- Evidence required (checkbox)

Tab 3 — Required Decisions
Table: Decision · Decision maker · By when · Status (Open / Decided / Overdue) · Notes

Tab 4 — Required Documents
Table: Document name · Type · Required for · Status · Upload button

Tab 5 — Dependencies (from previous phase)
List of items from previous phase that must be complete before this phase can properly begin.
Items shown with their current status — a red warning if a dependency is incomplete and this phase is marked active.

**Functionality:**
- Tasks and work packages save on blur (autosave) with a subtle "Saved" indicator
- Status changes trigger a backend gate re-evaluation job
- Phase cannot be marked "Complete" unless all required outputs have a status of Complete

---

### SCREEN: /projects/[id]/schedule

**View toggle (top right):** Gantt · Milestone List · Phase Summary

**Gantt view:**
- Rows: LPH phases (grouped) + key milestones + approval deadlines
- X-axis: monthly columns
- Phase bars: solid fill for confirmed dates, diagonal stripe pattern for derived dates
- Milestone diamonds: Bronze `#B7792E` for confirmed, grey with question mark for derived
- Critical path: Red `#B04A3A` border on bars in critical path
- Today line: Thin vertical line in Bronze
- Hover tooltip on any bar: name · start · end · data state · owner · status

**Bar color coding:**
- On track: `#0D2B1A` (dark green)
- At risk: `#2A1A08` (dark amber)
- Overdue: `#2A0D0D` (dark red)
- Future/derived: `#ECE8E1` with dashed border

**Milestone List view:**
Table: Date · Milestone name · Phase · Owner · Data state chip · Gate link · Status

**DERIVED dates banner (shown when any dates are derived):**
Yellow info bar: "Some dates are estimated by back-scheduling from target completion. Items marked DERIVED should be confirmed when possible."

**Add milestone button:** "+ Add milestone" → modal with: name, date, type (client decision/approval/phase gate/authority/handover), owner, related gate (optional)

---

### SCREEN: /projects/[id]/responsibilities

**Section header:** "Responsibility Matrix"
**Subtitle:** "Auto-generated from project structure. Update assignments as the project develops."

**Filter bar:** Phase filter (All / LPH 1–9) · Role filter · Status filter (Assigned / Unassigned)

**RACI matrix table:**
- Rows: Work packages and key tasks
- Column groups: Client team · Architect team · Consultants · Contractors
- Each column: a specific named role
- Cells: R (Responsible) · A (Accountable) · C (Consulted) · I (Informed) · — (not involved)
- Click any cell → dropdown to assign RACI value
- Unassigned R cells shown in light red `#FAF0EE` border

**Unassigned warning banner:** "N tasks have no responsible owner assigned."

**Export button:** "Export as CSV" downloads the RACI table.

**Functionality:**
- RACI data stored in `tasks` table fields (owner, reviewer, approver, informed_parties array)
- Changes saved immediately (optimistic update + server write)
- Unassigned R detection runs server-side after each save

---

### SCREEN: /projects/[id]/approvals

**Layout:** Top filter tabs by approval type + main table

**Approval type tabs:**
Client · Internal · Technical · Material · Package Release · Tender Release · Execution Release · Closeout

**Main table (per tab):**
Columns: Approval name · Phase · Gate · Requested by · Requested on · Approver · Due date · Status · Action

**Status chips:**
- Pending — grey
- In Review — Bronze
- Approved — Green `#3F7A5A`
- Rejected — Red `#B04A3A`
- Overdue — Red background

**Row actions:**
- Pending → "Request approval" button → opens modal: select approver, add message, set due date
- In Review → "Send reminder" button
- Approved → "View record" link

**Approval detail modal (on row click):**
- Approval name and type
- Related project object (task/gate/package/document)
- Request history (who requested, when, what message)
- Review comments (text area, adds to history)
- Approve / Reject / Request clarification buttons
- Each action requires a confirmation step and records: actor, timestamp, notes

**Functionality:**
- Approvals can only be actioned by the designated approver or workspace Architect Admin
- Approving/rejecting an approval triggers a gate re-evaluation
- Overdue approvals (past due date) appear in dashboard Action Required strip
- Email notification sent to approver on new request; to requestor on approval/rejection

---

### SCREEN: /projects/[id]/consultants

**Section header:** "Consultant Readiness"
**Subtitle:** "Consultants may only be invited once Gate C criteria are met for their discipline."

**One card per consultant discipline:**

Each card (white, 1px border, full width, collapsible):

Header row:
- Discipline name (e.g. "Structural Engineer")
- Readiness percentage (JetBrains Mono, Bronze)
- Status chip: "Invitation Ready ✓" (green) or "Not Ready — N criteria missing" (amber)

Expanded body:

**Readiness checklist (6 criteria):**
1. Clear scope description — [status chip] [Edit scope link]
2. Current project state visible — [auto-derived from project]
3. Expected outputs defined — [status chip] [Add outputs link]
4. Required input documents available or tracked — [status chip] [Manage inputs link]
5. Interfaces identified — [status chip] [Edit interfaces link]
6. Internal approval to invite — [status chip] [Request approval button]

Each criterion: checkmark (met) or × (not met) + brief status text.

**Below checklist:**
- "Invite [discipline]" button — LOCKED (greyed, tooltip: "N criteria not yet met") until all 6 criteria are ✓ AND Gate C is open
- When unlocked: button opens invitation modal

**Invitation modal:**
- Email address(es)
- Role: Consultant
- Disciplines: pre-filled
- Message (optional)
- Access level: Project-specific only
- Warning: "This person will be able to see [list of shared modules]. They will NOT see [list of restricted modules]."
- "Send invitation" button
- Confirmation: invitation logged to audit trail

**Add discipline button:** "+ Add consultant discipline" → modal: discipline name, contact name, company, email (optional)

---

### SCREEN: /projects/[id]/procurement

**Section header:** "Procurement & Tender Readiness"

**Top row:** Procurement model selector
"General Contractor" | "Single Trades" | "Unclear"
Changing this selection: updates downstream package logic + triggers a notification that the change is logged.

**Package list:**
Each row (expandable):
- Package name
- Procurement model chip
- Lead (assignable)
- Required docs count / uploaded count
- Missing consultant inputs count
- Open decisions count
- Tender ready: YES (green) / NO (red)
- Invitation enabled: YES / NO
- "View detail" → expands to full detail view below

**Package detail (expanded or modal):**

Section 1 — Package summary: name, description, scope, procurement model, responsible lead, target tender date

Section 2 — Required documents checklist:
Table: Document name · Status (Available/Missing/Outdated) · Upload button
Each row: upload stores to GCS, updates status

Section 3 — Open decisions:
Table: Decision · Owner · Due date · Status
Add decision button → modal with fields

Section 4 — Missing consultant inputs:
Table: Discipline · Required input · Status · Consultant status
Links to Consultant Readiness screen for that discipline

Section 5 — Tender readiness summary:
Shows all gate D sub-criteria relevant to this package. Each with status chip.
Overall: "Tender Ready: YES/NO"

Section 6 — Actions:
- "Issue to bidders" — LOCKED until Tender Ready = YES and Gate D = Complete
- On unlock: button opens bidder invitation flow
- "Add bidder" — manually add a bidder email to the package

**Bid return tracking (shown once bidders are invited):**
Table: Bidder company · Invited · Return due · Status (Pending/Returned/Late/Withdrawn) · Action

**Award workflow (shown once all bids returned):**
- Comparison view: bidders as columns, line items as rows (internal planner pricing hidden from bidder view)
- Award button → confirmation modal → logs award state with acting user, timestamp, related offer version
- Award state changes require Architect Admin or Client Admin confirmation

---

### SCREEN: /projects/[id]/documents

**Layout:** Left tree (200px) + right content area

**Left tree:**
Collapsible document type groups:
- Project Briefs
- Contracts
- Planning Documents
- Approval Documents
- Tender Documents
- Execution Documents
- Meeting Records
- Correspondence
- Evidence

Click a group to filter right panel. Click a document to open detail.

**Right panel — Document list:**
Table: Name · Type · Current version · Status chip · Last updated · Issued to · Actions (View/Download/New version)

**Document status chips:**
Draft · Internally Reviewed · Approved for Issue · Issued · Superseded · Awarded Baseline · Archived

**Document detail (modal on row click):**
- Filename and type
- Version history table: version number · date · uploaded by · status · changes note · download link
- Current version: [version] — [status chip]
- Issued to (list of roles/users)
- Approval record: approved by · timestamp
- "Upload new version" button → file picker → auto-increments version, prompts for change note
- "Mark as Superseded" → logs state change

**Upload new document button:** → modal with: file picker, document type dropdown, related phase (optional), related package (optional), initial status (Draft by default)

**Functionality:**
- All versions stored in GCS with path: `{workspace_id}/projects/{project_id}/documents/{doc_id}/v{n}/filename`
- Status transitions require specific roles: "Approved for Issue" requires Architect Admin or designated approver
- Documents linked to a gate (e.g. tender documents) must be in "Approved for Issue" state for the gate check to pass

---

### SCREEN: /projects/[id]/risks

**Two tabs:** Risks | Blockers

**Risks tab:**

"+ Add risk" button → modal with fields below.

Table: Risk name · Category · Probability (Low/Med/High) · Impact (Low/Med/High) · Risk score (computed = prob × impact) · Owner · Status · Actions

Risk score display: show as a colored square (green/amber/red) based on score.

Categories: Missing Information · Deadline Risk · Coordination Risk · Approval Risk · Execution Risk · Communication Risk · Contract Interface Risk · External / Authority

**Risk detail modal:**
- Name, category, description
- Probability and impact dropdowns
- Owner (user assignment)
- Status: Open / Mitigated / Closed / Accepted
- Mitigation action (textarea)
- Evidence / linked documents
- History log (changes with timestamps)

**Blockers tab:**

Table: Blocker description · Blocked gate · Blocked since · Owner · Downstream impact · Next action · Status

Blockers are auto-generated by the gate check engine AND manually addable.

Auto-generated blocker example: "Soil report missing — blocking Gate B, criterion 3."
Each auto-blocker has a link to the specific gate criterion.

Status: Active / Resolved / Accepted as Risk
Resolving a blocker triggers a gate re-evaluation.

---

### SCREEN: /projects/[id]/delays

**Warning banner at top:**
"This module is a structured evidence and consequence tracker. It does not determine or record legal liability."

**"+ Log delay event" button** → full-width modal

**Delay event form fields:**
- Event date (date picker)
- Reported by (user or free text for external parties)
- Description (textarea)
- Cause category (dropdown): Client Delay · Missing Approval · Design Change · Missing Information · Consultant Delay · Contractor Delay · Site Condition · Authority Issue · Logistics Issue · Unknown
- Affected tasks (multi-select from task list)
- Affected milestones (multi-select from schedule)
- Estimated schedule impact in working days (number input)
- Initial responsibility field (free text — note: not a legal determination)
- Evidence upload (files, photos)
- Status: Open / Under Review / Resolved / Escalated

**Delay log table:**
Columns: Date · Description · Cause · Affected milestones · Evidence · Impact days · Status · Owner · Actions (Edit/Resolve/Escalate)

**Escalation flow:**
Escalation button → modal: escalation note + select escalation recipient → sends notification + logs escalation step

**Delay summary panel (right sidebar or below table):**
- Total logged events: N
- Total estimated impact: N working days
- Events by cause category (simple bar chart using CSS, no library needed)
- Events by status

---

### SCREEN: /projects/[id]/reviews

**Section header:** "Shop Drawing & Submission Review"
**Note bar:** "This workflow becomes active at Gate E (Execution Ready). Reviews can be set up in advance."

**Status kanban board:**
6 columns (horizontal scroll on mobile):
Received → Completeness Check → Assigned → Under Review → Deviation Log → Closed (Approved or Resubmit Required)

Each submission is a card in the kanban. Card shows:
- Drawing/submission title
- Package name
- Contractor
- Submission date
- Reviewer (if assigned)
- Review due date (red if overdue)
- Deviation count badge (red)

**Drag-and-drop** between columns to update status (saves to database).

**Submission detail (click a card):**
Full-page modal or slide-out panel:

Top section:
- Submission title
- Package and contractor
- Submission date
- Status chip
- Reviewer (assignable dropdown)
- Review due date (date picker)

Tabs within detail:

Tab 1 — Documents
- Uploaded drawing files (with PDF viewer inline)
- Reference drawing links
- "Upload additional documents" button

Tab 2 — Deviation Log
Table: Item no. · Description · Severity (Minor/Major/Critical) · Design impact · Technical impact · Schedule impact · Status (Open/Resolved/Accepted) · Resolution notes
"+ Add deviation" button → inline form

Tab 3 — Review Record
- Reviewer name
- Review date
- Review outcome: Approved / Approved with Comments / Resubmission Required / Rejected
- Comments (textarea)
- "Submit review" button — requires review outcome to be selected; logs to audit trail

**Outcome rules:**
- "Approved" → card moves to Closed column, approval logged
- "Resubmission Required" → card returns to Received column with a resubmission flag
- Submitting a review triggers a notification to the submitting contractor

**"+ New submission" button:**
Modal: package selection, contractor, drawing title, file upload, reference drawings, submission date.

---

### SCREEN: /projects/[id]/execution

**Warning banner:**
"Execution evidence confirmation does not constitute formal acceptance, invoice approval, or commercial release. Separate controlled confirmation steps are required."

**View toggle:** Submissions · Review Queue · Accepted · Punch List · Invoicing Ready

---

**Submissions view:**
Table: Date · Contractor · Package · Description · Completion % · Evidence · Status · Reviewer · Action

**Submission detail (modal):**
- Package / trade
- Reported by (contractor user)
- Company
- Submission date
- Site area / location
- Related scope item or drawing (free text or linked)
- Photo gallery (uploaded images, viewable full-size)
- Text description
- Completion percentage (slider 0–100%)
- Quantity / measurement (optional)
- Attached files

**Review panel (visible to architect-side reviewers):**
Review outcome dropdown: Accepted · Partially Accepted · Rejected · Rework Required · Moved to Punch List · Requires Clarification
Review comment (textarea, required)
Next action (text)
"Submit review" button — logs: reviewer, date, outcome, comment, next action

**Punch list:**
Table: Item · From submission · Package · Contractor · Status (Open / In Progress / Closed) · Target close date · Owner
Items can be added manually or transferred from rejected execution evidence submissions.

**Invoicing Ready:**
Items that have been Accepted and are awaiting invoicing confirmation. This view shows: contractor, package, accepted date, amount if tracked. "Confirm ready for invoicing" requires Architect Admin or Client Admin action.

---

### SCREEN: /projects/[id]/gates

**Section header:** "Gate Control"
**Subtitle:** "Six gates control project progression. Each gate must be met or explicitly overridden by an Architect Admin."

**Layout:** Vertical stack of 6 gate sections, each expandable.

**Each gate section:**

Header (always visible):
- Gate letter + name + purpose (1 line)
- Status badge: Complete / In Progress / Locked / Overridden
- Readiness percentage
- Expand/collapse chevron

Expanded body:

**Purpose statement** (2 sentences explaining why this gate exists)

**Criteria checklist:**
Each criterion: checkbox (checked/unchecked) + criterion text + status chip + action link
Checked = criterion met. Unchecked = criterion not yet met.
Some criteria are auto-checked by the rule engine (e.g. "project name available").
Some criteria require a manual check/confirmation.

**Gate action buttons:**
- If all criteria met AND status = In Progress: "Mark Gate [X] as Complete" button → confirmation modal → logs completion
- "Override Gate" button (always visible, but greyed for non-admins)

**Override Gate flow:**
1. Only available to Architect Admin role
2. Modal: "You are overriding Gate [X]. This action is permanent and logged."
3. Required fields: Reason for override (textarea, min 50 chars) · Acknowledgment checkbox: "I confirm this override and accept responsibility for any consequences"
4. "Confirm override" button (Bronze)
5. On confirm: gate status → Overridden, logs: user, timestamp, reason, gate, affected consequences list

**Override indicator:**
An overridden gate shows a warning banner inside the gate section:
"Overridden by [Name] on [Date] — [Reason]. All downstream consequences are in effect."

**Gate dependency display:**
Below criteria, a "Unlocks" section showing which features/invitations become available when this gate is Complete.

---

### SCREEN: /projects/[id]/invitations (Team & Invitations)

**Two tabs:** Team | Invitation Control

**Team tab:**
Table of current project members: Name · Email · Role · Access level · Joined · Actions (Change role / Remove)
Roles: Architect Admin · Project Lead · Team Member · Client · Client Representative · Consultant · Reviewer · Approver · Document Controller · Bidder · General Contractor · Trade Contractor

**Invitation Control tab:**

**Eligibility table:**
Columns: Role · Eligible · Controlling gate · Missing criteria · Can invite · Last check date

Each row explains whether a given role can be invited right now and why/why not.

Row states:
- Eligible ✓ — "Invite" button active
- Not eligible — "Invite" button greyed, tooltip shows missing criteria
- Already invited — shows "Invited [date]" + status (Pending/Accepted)

**Invite action:**
1. Click "Invite" on an eligible role
2. Modal: Email(s) · Role (pre-filled) · Project access scope · Optional message
3. "Send invitation" → email sent via Postmark with unique invite link
4. Invitation logged: inviting user, timestamp, gate at time of invitation, role

**Invitation link:** Unique tokenized link (`/invite/[token]`) → recipient signs up or logs in → added to project with specified role

**Pending invitations section:**
Table: Email · Role · Invited by · Invited on · Expires · Status (Pending/Accepted/Expired) · Resend / Revoke buttons

---

### SCREEN: /inbox

**Purpose:** Workspace inbox — all incoming emails across all projects.

**Layout:** List panel (left 360px) + Detail panel (right)

**List panel:**
- Filter tabs: All · Unreviewed · Assigned · Archived
- Search bar
- Each message item: From name/email · Subject · Date · Attachment count icon · Project match chip (if AI matched) · Unreviewed badge

**Detail panel — selected message:**

Top section:
- From, To, Date, Subject
- Attachment list (click to download or preview)

**AI analysis panel** (below email content):
Shown as a distinct section with label "AI Analysis":
- Suggested project match: "[Project name] — [confidence %, e.g. 87%]" with "Assign" button
- Detected document type: e.g. "Offer / Tender Return"
- Detected signals (chips):
  - "Offer Received?" — amber chip
  - "Approval Indicated?" — amber chip
  - "Award Indicated?" — amber chip
  - "Deadline Mentioned?" — amber chip

**Important UI rule:** All AI signals show with a "?" suffix and amber styling. No signal is shown as a fact.

**Action buttons:**
- "Assign to project" → dropdown of active projects → assigns message + attachments to selected project
- "Create new project" → pre-populates Step 2 of project intake with this message content
- "Mark as [Offer Received / Approval Received / Award Received]" → opens confirmation modal

**Confirmation modal for status changes:**
- Shows: "You are about to mark this message as [status]. This will [explain consequence]. This action is logged."
- Confirm button → logs: acting user, timestamp, message ID, new status, project ID

**Archive button:** moves message to Archived tab; no status change.

---

### SCREEN: /settings

**Sub-navigation (left tabs within settings):**
Workspace · Team · Notifications · Gate Rules · Integrations · Audit Log · Billing · Data & Privacy

---

**Settings: Workspace**
- Workspace name (editable)
- Logo (upload/replace)
- Address fields
- Workspace inbox address (read-only, copy button)
- Default country
- Default timezone
- "Save changes" button

---

**Settings: Team**
Table: Name · Email · Role · Status (Active/Invited/Suspended) · Last active · Actions
- Change role: dropdown → confirmation modal (Architect Admin changes require another Admin)
- Remove from workspace: confirmation modal → user loses access to all workspace projects
- Invite new member: email + role → sends invitation email
- Roles available at workspace level: Architect Admin · Project Lead · Team Member

---

**Settings: Notifications**
Per-event toggles for Email and In-App notifications:
Events:
- Gate becomes blocked
- Approval request received
- Approval overdue
- Consultant invitation ready
- Tender package becomes ready
- Gate override performed by another admin
- Delay event logged
- Review submission received
- Review overdue
- Inbox message received (unreviewed)

---

**Settings: Gate Rules**
Who can override which gate:
- For each gate A–F: dropdown → "Architect Admin only" or "Any Project Lead with reason"
- Default: Architect Admin only for all gates

---

**Settings: Integrations**
**GAEB exchange:**
- Status: Connected / Not configured
- Configure button → modal: upload GAEB file or paste endpoint

**Excel/CSV import:**
- Template download button (downloads standard Tenderfish bid return template)
- Import instructions

**Workspace inbox:**
- Current inbox address
- Option to add a project-specific inbox alias
- Forwarding setup instructions (static guide, not automated)

**Future (greyed out, "Coming Phase 2"):**
Gmail · Outlook · Procore · DATEV

---

**Settings: Audit Log**
Full workspace-level action history.
Filter by: User · Date range · Action type · Project
Table: Timestamp · User · Role · Action · Entity · Before/After state (expandable) · Project
Export button: "Export audit log (CSV)" — downloads filtered results

---

**Settings: Billing**
- Current plan name
- Usage: projects (N of N) · users (N of N)
- Next invoice date and amount
- Payment method (Stripe-managed)
- Invoice history (table: date, amount, PDF download)
- Upgrade / Downgrade plan button → shows plan comparison modal
- Cancel subscription (requires confirmation, notes retention period)

---

**Settings: Data & Privacy**
- "Export all workspace data" — initiates a GCS export job, emails download link when ready
- "Delete workspace" — two-step confirmation (type workspace name) → marks for deletion, 30-day recovery window
- GDPR data processing agreement: view / download PDF
- Data retention policy: shows configured retention period
- Right to erasure request: form to submit a data deletion request

---

## ROLE-BASED ACCESS CONTROL MATRIX

| Feature | Arch Admin | Project Lead | Team Member | Client | Consultant | Bidder | Contractor |
|---|---|---|---|---|---|---|---|
| Create project | ✓ | ✓ | — | — | — | — | — |
| View project overview | ✓ | ✓ | ✓ | ✓ (limited) | ✓ (scoped) | — | — |
| Edit project facts | ✓ | ✓ | ✓ | — | — | — | — |
| Override gates | ✓ | — | — | — | — | — | — |
| Request approval | ✓ | ✓ | ✓ | — | — | — | — |
| Approve/reject approvals | ✓ | ✓ (if designated) | — | ✓ (client approvals) | — | — | — |
| Invite consultants | ✓ | ✓ (Gate C+) | — | — | — | — | — |
| Invite bidders | ✓ | ✓ (Gate D+) | — | — | — | — | — |
| View tender docs | ✓ | ✓ | ✓ | ✓ (if permitted) | ✓ (scoped) | ✓ (own package) | — |
| View internal pricing | ✓ | ✓ | ✓ | ✓ (if permitted) | — | — | — |
| Submit bid return | — | — | — | — | — | ✓ | — |
| Submit execution evidence | — | — | — | — | — | — | ✓ |
| Review execution evidence | ✓ | ✓ | — | — | — | — | — |
| View audit log | ✓ | ✓ (project-level) | — | — | — | — | — |
| Export audit pack | ✓ | — | — | — | — | — | — |
| Manage workspace | ✓ | — | — | — | — | — | — |

---

## NOTIFICATION SYSTEM

**Delivery:** In-app notification bell (badge count) + Email (Postmark)

**Notification types and triggers:**
- Gate blocked: triggered by gate re-evaluation job finding a previously passing criterion now failing
- Approval overdue: daily cron job checks due dates vs current date
- Approval requested: triggered on approval.create event
- Consultant invitation ready: triggered when a consultant's readiness score reaches 100% for first time
- Tender package ready: triggered when package tender_ready flips to true
- Gate override: triggered on gate.override event — notifies all project Arch Admins
- Review submission received: triggered on review_submission.create
- Review overdue: cron job
- Inbox unreviewed: triggered on inbox_message.create if not auto-assigned

**Email template style:** Plain text with minimal HTML. DM Sans. Dark ink on white. No decorative elements. Subject line format: "[Tenderfish] [Project name] — [Action required]"

---

## CLOUD ARCHITECTURE (Google Cloud)

- **Cloud Run:** Two services — `api` (Node.js Fastify) and `web` (Next.js). Both containerized with Docker.
- **Cloud SQL:** PostgreSQL 15 instance (private IP, accessed via Cloud SQL Auth Proxy)
- **Cloud Storage:** One bucket per environment (`tenderfish-prod-files`, `tenderfish-staging-files`). Files organized by `workspace_id/project_id/document_id/`
- **Cloud Build:** CI/CD pipeline triggered on main branch push. Builds Docker images, pushes to Artifact Registry, deploys to Cloud Run.
- **Secret Manager:** All secrets (database URL, Anthropic API key, Clerk keys, Postmark API key) stored in Secret Manager and injected as environment variables at deploy time.
- **Cloud Tasks:** Async job queue for AI processing pipeline. Job created on project intake submit, processed by a separate Cloud Run worker service.
- **Cloud Scheduler:** Cron jobs for daily notification checks (overdue approvals, overdue reviews).
- **Cloud Armor:** WAF in front of Cloud Run for basic DDoS and OWASP protection.

**Environment variables required:**
```
DATABASE_URL=
REDIS_URL=
ANTHROPIC_API_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
POSTMARK_API_KEY=
POSTMARK_INBOUND_HASH=
GCS_BUCKET_NAME=
GCS_PROJECT_ID=
```

---

## API STRUCTURE (Fastify)

```
POST   /api/auth/...                    (Clerk webhook handlers)
GET    /api/workspaces/me               (current workspace)
PATCH  /api/workspaces/me              (update workspace)

GET    /api/projects                    (list workspace projects)
POST   /api/projects                    (create project)
GET    /api/projects/:id               (project detail)
PATCH  /api/projects/:id              (update project)

POST   /api/projects/:id/intake        (trigger AI pipeline, returns job_id)
GET    /api/jobs/:jobId/status         (poll job status)

GET    /api/projects/:id/facts         (extracted facts)
PATCH  /api/projects/:id/facts/:factId (update fact value or data_state)

GET    /api/projects/:id/phases        (all phases)
PATCH  /api/projects/:id/phases/:lph  (update phase)

GET    /api/projects/:id/tasks         (all tasks, filterable by phase)
POST   /api/projects/:id/tasks         (create task)
PATCH  /api/projects/:id/tasks/:taskId

GET    /api/projects/:id/gates         (all gates)
POST   /api/projects/:id/gates/:gate/complete   (mark gate complete)
POST   /api/projects/:id/gates/:gate/override   (override gate, admin only)

GET    /api/projects/:id/approvals
POST   /api/projects/:id/approvals
PATCH  /api/projects/:id/approvals/:approvalId  (approve/reject)

GET    /api/projects/:id/consultants
POST   /api/projects/:id/consultants
PATCH  /api/projects/:id/consultants/:consultantId

GET    /api/projects/:id/tender-packages
POST   /api/projects/:id/tender-packages
PATCH  /api/projects/:id/tender-packages/:packageId

GET    /api/projects/:id/documents
POST   /api/projects/:id/documents
POST   /api/projects/:id/documents/:docId/versions  (upload new version)

GET    /api/projects/:id/delays
POST   /api/projects/:id/delays
PATCH  /api/projects/:id/delays/:delayId

GET    /api/projects/:id/reviews
POST   /api/projects/:id/reviews
PATCH  /api/projects/:id/reviews/:reviewId

GET    /api/projects/:id/invitations
POST   /api/projects/:id/invitations    (send invitation)
DELETE /api/projects/:id/invitations/:invId  (revoke)

GET    /api/inbox                       (workspace inbox messages)
PATCH  /api/inbox/:messageId           (assign to project, mark status)

GET    /api/projects/:id/audit-log
GET    /api/workspaces/me/audit-log

POST   /api/webhooks/postmark-inbound   (incoming email webhook)
```

---

*End of Tenderfish application specification.*
*For homepage design spec see homepage_section_1–4.md files.*
