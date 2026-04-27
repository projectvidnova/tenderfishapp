CREATE TYPE "public"."abnahme_status" AS ENUM('scheduled', 'completed_without_defects', 'completed_with_defects', 'refused');--> statement-breakpoint
CREATE TYPE "public"."abnahme_type" AS ENUM('foermliche_abnahme', 'stillschweigende_abnahme', 'teilabnahme', 'fiktive_abnahme');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'in_review', 'approved', 'rejected', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."approval_type" AS ENUM('client', 'internal', 'technical', 'material', 'package_release', 'tender_release', 'execution_release', 'closeout');--> statement-breakpoint
CREATE TYPE "public"."bidder_status" AS ENUM('invited', 'pending', 'returned', 'late', 'withdrawn', 'awarded');--> statement-breakpoint
CREATE TYPE "public"."compliance_area" AS ENUM('bauordnung', 'brandschutz', 'geg_energy', 'sigeko', 'denkmalschutz', 'umweltschutz', 'schallschutz', 'barrierefreiheit');--> statement-breakpoint
CREATE TYPE "public"."compliance_status" AS ENUM('not_applicable', 'not_started', 'in_preparation', 'submitted', 'approved', 'conditionally_approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'tendered', 'awarded', 'active', 'in_warranty', 'closed', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."cost_snapshot_status" AS ENUM('draft', 'submitted', 'approved', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."cost_stage" AS ENUM('kostenrahmen', 'kostenschaetzung', 'kostenberechnung', 'kostenanschlag', 'kostenfeststellung');--> statement-breakpoint
CREATE TYPE "public"."data_state" AS ENUM('CONFIRMED', 'DERIVED', 'UNCLEAR', 'MISSING');--> statement-breakpoint
CREATE TYPE "public"."decision_status" AS ENUM('open', 'decided', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."delay_cause" AS ENUM('client_delay', 'missing_approval', 'design_change', 'missing_information', 'consultant_delay', 'contractor_delay', 'site_condition', 'authority_issue', 'logistics_issue', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."delay_status" AS ENUM('open', 'under_review', 'resolved', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'internally_reviewed', 'approved_for_issue', 'issued', 'superseded', 'awarded_baseline', 'archived');--> statement-breakpoint
CREATE TYPE "public"."gaeb_exchange_phase" AS ENUM('gaeb_81', 'gaeb_82', 'gaeb_83', 'gaeb_84', 'gaeb_85', 'gaeb_86', 'gaeb_87', 'gaeb_89', 'gaeb_90', 'gaeb_da11');--> statement-breakpoint
CREATE TYPE "public"."gaeb_position_type" AS ENUM('normalposition', 'alternativposition', 'eventuaposition', 'bedarfsposition', 'grundposition', 'wahlposition', 'zuschlagsposition', 'pauschalposition', 'stundenlohnarbeiten');--> statement-breakpoint
CREATE TYPE "public"."gate_letter" AS ENUM('A', 'B', 'C', 'D', 'E', 'F');--> statement-breakpoint
CREATE TYPE "public"."gate_status" AS ENUM('locked', 'in_progress', 'complete', 'overridden');--> statement-breakpoint
CREATE TYPE "public"."health_score" AS ENUM('green', 'amber', 'red');--> statement-breakpoint
CREATE TYPE "public"."hoai_fee_zone" AS ENUM('I', 'II', 'III', 'IV', 'V');--> statement-breakpoint
CREATE TYPE "public"."hoai_service_type" AS ENUM('gebaeudeplanung', 'freianlagenplanung', 'tragwerksplanung', 'technische_ausruestung');--> statement-breakpoint
CREATE TYPE "public"."inbox_status" AS ENUM('unreviewed', 'assigned', 'archived', 'auto_classified', 'low_confidence', 'needs_role_confirmation', 'needs_project_assignment');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('not_ready', 'ready', 'invited', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'processing', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."milestone_type" AS ENUM('client_decision', 'approval', 'phase_gate', 'authority', 'handover');--> statement-breakpoint
CREATE TYPE "public"."nachtrag_status" AS ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'partially_approved');--> statement-breakpoint
CREATE TYPE "public"."nachtrag_type" AS ENUM('mengenabweichung', 'geaenderte_leistung', 'zusaetzliche_leistung', 'selbst_uebernahme', 'behinderung', 'stundenlohn');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('gate_blocked', 'approval_overdue', 'approval_requested', 'consultant_invitation_ready', 'tender_package_ready', 'gate_override', 'review_submission_received', 'review_overdue', 'inbox_unreviewed', 'general');--> statement-breakpoint
CREATE TYPE "public"."participant_access_level" AS ENUM('external_source', 'lightweight', 'full_account');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('submitted', 'under_review', 'approved', 'paid', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('abschlagszahlung', 'teilschlussrechnung', 'schlussrechnung', 'sicherheitseinbehalt');--> statement-breakpoint
CREATE TYPE "public"."phase_status" AS ENUM('not_started', 'active', 'complete');--> statement-breakpoint
CREATE TYPE "public"."procurement_model" AS ENUM('general_contractor', 'single_trades', 'unclear');--> statement-breakpoint
CREATE TYPE "public"."project_lifecycle_state" AS ENUM('input_received', 'parsed', 'needs_review', 'confirmed', 'structure_approved', 'cost_ready', 'detail_ready', 'tender_ready', 'released_for_tender');--> statement-breakpoint
CREATE TYPE "public"."project_role" AS ENUM('architect_admin', 'project_lead', 'team_member', 'client', 'client_representative', 'consultant', 'reviewer', 'approver', 'document_controller', 'bidder', 'general_contractor', 'trade_contractor');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'on_hold', 'archived');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('new_build', 'refurbishment', 'conversion', 'interior_fit_out', 'mixed_use', 'not_sure');--> statement-breakpoint
CREATE TYPE "public"."review_outcome" AS ENUM('approved', 'approved_with_comments', 'resubmission_required', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('received', 'completeness_check', 'assigned', 'under_review', 'deviation_log', 'closed');--> statement-breakpoint
CREATE TYPE "public"."review_type" AS ENUM('shop_drawing', 'execution_evidence');--> statement-breakpoint
CREATE TYPE "public"."risk_category" AS ENUM('missing_information', 'deadline_risk', 'coordination_risk', 'approval_risk', 'execution_risk', 'communication_risk', 'contract_interface_risk', 'external_authority');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."risk_status" AS ENUM('open', 'mitigated', 'closed', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."spd_status" AS ENUM('draft', 'submitted', 'approved', 'revision_requested');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('not_started', 'in_progress', 'complete');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('required_output', 'work_package', 'decision', 'document', 'dependency');--> statement-breakpoint
CREATE TYPE "public"."tender_release_status" AS ENUM('pending_review', 'ready', 'released', 'recalled');--> statement-breakpoint
CREATE TYPE "public"."vob_contract_type" AS ENUM('vob_b', 'bgb_werkvertrag');--> statement-breakpoint
CREATE TYPE "public"."vob_tendering_procedure" AS ENUM('oeffentliche_ausschreibung', 'beschraenkte_ausschreibung', 'beschraenkte_ausschreibung_mit_tw', 'verhandlungsvergabe', 'verhandlungsvergabe_mit_tw', 'wettbewerblicher_dialog', 'direktauftrag');--> statement-breakpoint
CREATE TYPE "public"."workspace_plan" AS ENUM('free', 'starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('architect_admin', 'project_lead', 'team_member');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "abnahmen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "abnahme_type" NOT NULL,
	"scheduled_date" date NOT NULL,
	"actual_date" date,
	"status" "abnahme_status" DEFAULT 'scheduled' NOT NULL,
	"attendees" jsonb DEFAULT '[]'::jsonb,
	"defects" jsonb DEFAULT '[]'::jsonb,
	"warranty_start_date" date,
	"protocol_ref" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"type" "approval_type" NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"approver_user_id" uuid,
	"due_date" date,
	"approved_at" timestamp with time zone,
	"notes" text,
	"related_gate" varchar(1),
	"related_phase_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"user_id" uuid NOT NULL,
	"action" varchar(255) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bidders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"company" varchar(255) NOT NULL,
	"contact_name" varchar(255),
	"email" varchar(255),
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"return_due" date,
	"status" "bidder_status" DEFAULT 'invited' NOT NULL,
	"offer_amount" integer,
	"offer_notes" text,
	"returned_at" timestamp with time zone,
	"awarded_at" timestamp with time zone,
	"awarded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consultants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"discipline" varchar(255) NOT NULL,
	"contact_name" varchar(255),
	"company" varchar(255),
	"email" varchar(255),
	"readiness_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"invitation_status" "invitation_status" DEFAULT 'not_ready' NOT NULL,
	"invited_at" timestamp with time zone,
	"invited_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"package_id" uuid,
	"contract_number" varchar(100),
	"title" varchar(500) NOT NULL,
	"contract_type" "vob_contract_type" DEFAULT 'vob_b' NOT NULL,
	"tendering_procedure" "vob_tendering_procedure",
	"contractor_company" varchar(255) NOT NULL,
	"contractor_contact" varchar(255),
	"contractor_email" varchar(255),
	"award_date" date,
	"commencement_date" date,
	"completion_date" date,
	"abnahme_date" date,
	"warranty_end_date" date,
	"warranty_period_months" integer DEFAULT 48 NOT NULL,
	"contract_value_net" integer DEFAULT 0 NOT NULL,
	"contract_value_gross" integer DEFAULT 0 NOT NULL,
	"retention_percentage" integer DEFAULT 500 NOT NULL,
	"retention_amount" integer DEFAULT 0 NOT NULL,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"vob_c_reference" varchar(100),
	"cost_group_code" varchar(10),
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"cost_group_code" varchar(10) NOT NULL,
	"project_type" "project_type",
	"region" varchar(255),
	"price_per_unit" integer NOT NULL,
	"unit" varchar(50) NOT NULL,
	"reference_year" integer NOT NULL,
	"source" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"cost_group_code" varchar(10) NOT NULL,
	"cost_group_level" integer NOT NULL,
	"description" text,
	"amount_net" integer DEFAULT 0 NOT NULL,
	"amount_gross" integer DEFAULT 0 NOT NULL,
	"quantity" integer,
	"unit" varchar(50),
	"unit_price" integer,
	"source" varchar(255),
	"data_state" "data_state" DEFAULT 'DERIVED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cost_stage" "cost_stage" NOT NULL,
	"phase_id" uuid,
	"snapshot_date" date NOT NULL,
	"total_gross" integer DEFAULT 0 NOT NULL,
	"total_net" integer DEFAULT 0 NOT NULL,
	"vat_rate" integer DEFAULT 1900 NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"notes" text,
	"status" "cost_snapshot_status" DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delay_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"event_date" date NOT NULL,
	"reported_by" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"cause_category" "delay_cause" NOT NULL,
	"affected_tasks" jsonb DEFAULT '[]'::jsonb,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb,
	"schedule_impact_days" integer DEFAULT 0 NOT NULL,
	"initial_responsibility" text,
	"status" "delay_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"type" varchar(100) NOT NULL,
	"versions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"is_approved_resource" boolean DEFAULT false NOT NULL,
	"approved_resource_at" timestamp with time zone,
	"approved_resource_by" uuid,
	"source_channel" varchar(100),
	"confidence" integer,
	"provenance_data" jsonb,
	"created_by" uuid,
	"related_phase_id" uuid,
	"related_package_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gaeb_exchange_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"lv_id" uuid,
	"direction" varchar(10) NOT NULL,
	"exchange_phase" "gaeb_exchange_phase" NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_ref" text NOT NULL,
	"file_size" integer NOT NULL,
	"gaeb_version" varchar(20),
	"positions_imported" integer,
	"error_log" text,
	"imported_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"gate" "gate_letter" NOT NULL,
	"status" "gate_status" DEFAULT 'locked' NOT NULL,
	"criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"override_active" boolean DEFAULT false NOT NULL,
	"override_reason" text,
	"override_by" uuid,
	"override_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hoai_fee_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"service_type" "hoai_service_type" NOT NULL,
	"fee_zone" "hoai_fee_zone" NOT NULL,
	"anrechenbare_kosten" integer NOT NULL,
	"fee_position_in_zone" integer DEFAULT 50 NOT NULL,
	"base_fee" integer DEFAULT 0 NOT NULL,
	"agreed_percentage" integer,
	"commissioned_phases" jsonb DEFAULT '[1,2,3,4,5,6,7,8,9]'::jsonb NOT NULL,
	"phase_fees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"modifiers" jsonb DEFAULT '[]'::jsonb,
	"total_fee" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"from_email" varchar(255) NOT NULL,
	"subject" varchar(1000) NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_suggestions" jsonb,
	"status" "inbox_status" DEFAULT 'unreviewed' NOT NULL,
	"confidence" integer,
	"classified_type" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"email" varchar(255) NOT NULL,
	"role" "project_role" NOT NULL,
	"gate_at_invitation" varchar(1),
	"invited_by" uuid NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"type" varchar(100) NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"current_step" varchar(100),
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leistungsverzeichnisse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"package_id" uuid,
	"contract_id" uuid,
	"title" varchar(500) NOT NULL,
	"lv_number" varchar(100),
	"exchange_phase" "gaeb_exchange_phase" DEFAULT 'gaeb_83' NOT NULL,
	"cost_group_code" varchar(10),
	"vob_c_reference" varchar(100),
	"total_net" integer DEFAULT 0 NOT NULL,
	"total_gross" integer DEFAULT 0 NOT NULL,
	"position_count" integer DEFAULT 0 NOT NULL,
	"gaeb_file_ref" text,
	"gaeb_version" varchar(20),
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lv_positionen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lv_id" uuid NOT NULL,
	"ordnungszahl" varchar(50) NOT NULL,
	"titel" varchar(500),
	"titel_level" integer DEFAULT 0 NOT NULL,
	"position_type" "gaeb_position_type" DEFAULT 'normalposition' NOT NULL,
	"kurztext" varchar(500) NOT NULL,
	"langtext" text,
	"menge" integer DEFAULT 0 NOT NULL,
	"einheit" varchar(50) NOT NULL,
	"einheitspreis" integer DEFAULT 0 NOT NULL,
	"gesamtpreis" integer DEFAULT 0 NOT NULL,
	"cost_group_code" varchar(10),
	"linked_position_id" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"date" date NOT NULL,
	"type" "milestone_type" NOT NULL,
	"owner_user_id" uuid,
	"related_gate" varchar(1),
	"related_phase_id" uuid,
	"data_state" "data_state" DEFAULT 'DERIVED' NOT NULL,
	"status" "task_status" DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nachtraege" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"nachtrag_number" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"type" "nachtrag_type" NOT NULL,
	"vob_reference" varchar(100),
	"description" text NOT NULL,
	"requested_amount_net" integer DEFAULT 0 NOT NULL,
	"approved_amount_net" integer,
	"schedule_impact_days" integer DEFAULT 0 NOT NULL,
	"submitted_by" varchar(255) NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"status" "nachtrag_status" DEFAULT 'draft' NOT NULL,
	"supporting_documents" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"body" text,
	"entity_type" varchar(100),
	"entity_id" uuid,
	"read" boolean DEFAULT false NOT NULL,
	"email_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"company" varchar(255),
	"role" "project_role" DEFAULT 'team_member' NOT NULL,
	"access_level" "participant_access_level" DEFAULT 'external_source' NOT NULL,
	"role_confirmed" boolean DEFAULT false NOT NULL,
	"inferred_from" jsonb,
	"user_id" uuid,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"payment_number" varchar(50) NOT NULL,
	"type" "payment_type" NOT NULL,
	"invoice_date" date NOT NULL,
	"invoice_ref" varchar(255),
	"amount_net" integer NOT NULL,
	"amount_gross" integer NOT NULL,
	"vat_rate" integer DEFAULT 1900 NOT NULL,
	"cumulative_net" integer DEFAULT 0 NOT NULL,
	"retention_deducted" integer DEFAULT 0 NOT NULL,
	"due_date" date,
	"paid_date" date,
	"status" "payment_status" DEFAULT 'submitted' NOT NULL,
	"reviewed_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"lph" integer NOT NULL,
	"status" "phase_status" DEFAULT 'not_started' NOT NULL,
	"start_date" date,
	"end_date" date,
	"date_data_state" "data_state" DEFAULT 'MISSING' NOT NULL,
	"objective" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_descriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "spd_status" DEFAULT 'draft' NOT NULL,
	"project_name" varchar(500),
	"project_goal" text,
	"project_type" varchar(100),
	"location" text,
	"participants" jsonb DEFAULT '[]'::jsonb,
	"scope_of_work" text,
	"spatial_scope" text,
	"relevant_approved_documents" jsonb DEFAULT '[]'::jsonb,
	"assumptions" jsonb DEFAULT '[]'::jsonb,
	"open_points" jsonb DEFAULT '[]'::jsonb,
	"current_project_phase" varchar(100),
	"approved_project_resources" jsonb DEFAULT '[]'::jsonb,
	"current_defined_project_status" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"field_name" varchar(255) NOT NULL,
	"value" text,
	"data_state" "data_state" DEFAULT 'MISSING' NOT NULL,
	"source_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"label" varchar(255) NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"type" "project_type" DEFAULT 'not_sure' NOT NULL,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"lifecycle_state" "project_lifecycle_state" DEFAULT 'input_received' NOT NULL,
	"procurement_model" "procurement_model" DEFAULT 'unclear' NOT NULL,
	"target_completion" date,
	"health_score" "health_score" DEFAULT 'green' NOT NULL,
	"objective" text,
	"scope_summary" text,
	"location" varchar(500),
	"client_name" varchar(255),
	"client_representative" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regulatory_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"area" "compliance_area" NOT NULL,
	"submission_type" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"authority" varchar(255),
	"reference_number" varchar(255),
	"submitted_date" date,
	"expected_response_date" date,
	"approved_date" date,
	"expiry_date" date,
	"status" "compliance_status" DEFAULT 'not_started' NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb,
	"related_phase_id" uuid,
	"document_ref" text,
	"responsible_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"type" "review_type" NOT NULL,
	"package_name" varchar(255),
	"contractor" varchar(255),
	"submitted_by" varchar(255) NOT NULL,
	"submission_date" date NOT NULL,
	"status" "review_status" DEFAULT 'received' NOT NULL,
	"deviations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reviewer_id" uuid,
	"review_due_date" date,
	"review_outcome" "review_outcome",
	"review_comment" text,
	"review_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"category" "risk_category" NOT NULL,
	"description" text,
	"probability" "risk_level" DEFAULT 'medium' NOT NULL,
	"impact" "risk_level" DEFAULT 'medium' NOT NULL,
	"owner_user_id" uuid,
	"status" "risk_status" DEFAULT 'open' NOT NULL,
	"mitigation_action" text,
	"linked_documents" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(255),
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"type" "task_type" DEFAULT 'work_package' NOT NULL,
	"owner_user_id" uuid,
	"reviewer_user_id" uuid,
	"approver_user_id" uuid,
	"due_date" date,
	"status" "task_status" DEFAULT 'not_started' NOT NULL,
	"dependencies" jsonb DEFAULT '[]'::jsonb,
	"evidence_ref" text,
	"evidence_required" boolean DEFAULT false NOT NULL,
	"decision_maker" varchar(255),
	"decision_status" "decision_status",
	"decision_notes" text,
	"document_type" varchar(255),
	"document_required_for" varchar(500),
	"document_file_ref" text,
	"raci_responsible" varchar(255),
	"raci_accountable" varchar(255),
	"raci_consulted" jsonb DEFAULT '[]'::jsonb,
	"raci_informed" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tender_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"scope" text,
	"procurement_model" "procurement_model" DEFAULT 'unclear' NOT NULL,
	"lead_user_id" uuid,
	"target_tender_date" date,
	"readiness_score" integer DEFAULT 0 NOT NULL,
	"tender_ready" boolean DEFAULT false NOT NULL,
	"invitation_enabled" boolean DEFAULT false NOT NULL,
	"blockers" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tender_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "tender_release_status" DEFAULT 'pending_review' NOT NULL,
	"prerequisites" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"released_by" uuid,
	"released_at" timestamp with time zone,
	"recalled_by" uuid,
	"recalled_at" timestamp with time zone,
	"recall_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "workspace_role" DEFAULT 'team_member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"plan" "workspace_plan" DEFAULT 'free' NOT NULL,
	"inbox_email" varchar(255) NOT NULL,
	"logo_url" text,
	"street" varchar(255),
	"city" varchar(255),
	"postcode" varchar(20),
	"country" varchar(100) DEFAULT 'Germany' NOT NULL,
	"tax_id" varchar(100),
	"default_timezone" varchar(100) DEFAULT 'Europe/Berlin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug"),
	CONSTRAINT "workspaces_inbox_email_unique" UNIQUE("inbox_email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "abnahmen" ADD CONSTRAINT "abnahmen_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "abnahmen" ADD CONSTRAINT "abnahmen_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "abnahmen" ADD CONSTRAINT "abnahmen_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_related_phase_id_phases_id_fk" FOREIGN KEY ("related_phase_id") REFERENCES "public"."phases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bidders" ADD CONSTRAINT "bidders_package_id_tender_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."tender_packages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bidders" ADD CONSTRAINT "bidders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bidders" ADD CONSTRAINT "bidders_awarded_by_users_id_fk" FOREIGN KEY ("awarded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consultants" ADD CONSTRAINT "consultants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consultants" ADD CONSTRAINT "consultants_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contracts" ADD CONSTRAINT "contracts_package_id_tender_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."tender_packages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cost_benchmarks" ADD CONSTRAINT "cost_benchmarks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cost_line_items" ADD CONSTRAINT "cost_line_items_snapshot_id_cost_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."cost_snapshots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cost_snapshots" ADD CONSTRAINT "cost_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cost_snapshots" ADD CONSTRAINT "cost_snapshots_phase_id_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."phases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cost_snapshots" ADD CONSTRAINT "cost_snapshots_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cost_snapshots" ADD CONSTRAINT "cost_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delay_events" ADD CONSTRAINT "delay_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_approved_resource_by_users_id_fk" FOREIGN KEY ("approved_resource_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_related_phase_id_phases_id_fk" FOREIGN KEY ("related_phase_id") REFERENCES "public"."phases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_related_package_id_tender_packages_id_fk" FOREIGN KEY ("related_package_id") REFERENCES "public"."tender_packages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gaeb_exchange_log" ADD CONSTRAINT "gaeb_exchange_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gaeb_exchange_log" ADD CONSTRAINT "gaeb_exchange_log_lv_id_leistungsverzeichnisse_id_fk" FOREIGN KEY ("lv_id") REFERENCES "public"."leistungsverzeichnisse"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gaeb_exchange_log" ADD CONSTRAINT "gaeb_exchange_log_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gates" ADD CONSTRAINT "gates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gates" ADD CONSTRAINT "gates_override_by_users_id_fk" FOREIGN KEY ("override_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hoai_fee_calculations" ADD CONSTRAINT "hoai_fee_calculations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hoai_fee_calculations" ADD CONSTRAINT "hoai_fee_calculations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leistungsverzeichnisse" ADD CONSTRAINT "leistungsverzeichnisse_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leistungsverzeichnisse" ADD CONSTRAINT "leistungsverzeichnisse_package_id_tender_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."tender_packages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leistungsverzeichnisse" ADD CONSTRAINT "leistungsverzeichnisse_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leistungsverzeichnisse" ADD CONSTRAINT "leistungsverzeichnisse_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lv_positionen" ADD CONSTRAINT "lv_positionen_lv_id_leistungsverzeichnisse_id_fk" FOREIGN KEY ("lv_id") REFERENCES "public"."leistungsverzeichnisse"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestones" ADD CONSTRAINT "milestones_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestones" ADD CONSTRAINT "milestones_related_phase_id_phases_id_fk" FOREIGN KEY ("related_phase_id") REFERENCES "public"."phases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nachtraege" ADD CONSTRAINT "nachtraege_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nachtraege" ADD CONSTRAINT "nachtraege_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nachtraege" ADD CONSTRAINT "nachtraege_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "participants" ADD CONSTRAINT "participants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "participants" ADD CONSTRAINT "participants_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "phases" ADD CONSTRAINT "phases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_descriptions" ADD CONSTRAINT "project_descriptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_descriptions" ADD CONSTRAINT "project_descriptions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_descriptions" ADD CONSTRAINT "project_descriptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_facts" ADD CONSTRAINT "project_facts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "regulatory_submissions" ADD CONSTRAINT "regulatory_submissions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "regulatory_submissions" ADD CONSTRAINT "regulatory_submissions_related_phase_id_phases_id_fk" FOREIGN KEY ("related_phase_id") REFERENCES "public"."phases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "regulatory_submissions" ADD CONSTRAINT "regulatory_submissions_responsible_user_id_users_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_submissions" ADD CONSTRAINT "review_submissions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_submissions" ADD CONSTRAINT "review_submissions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "risks" ADD CONSTRAINT "risks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "risks" ADD CONSTRAINT "risks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_phase_id_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."phases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_packages" ADD CONSTRAINT "tender_packages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_packages" ADD CONSTRAINT "tender_packages_lead_user_id_users_id_fk" FOREIGN KEY ("lead_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_releases" ADD CONSTRAINT "tender_releases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_releases" ADD CONSTRAINT "tender_releases_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_releases" ADD CONSTRAINT "tender_releases_recalled_by_users_id_fk" FOREIGN KEY ("recalled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abnahmen_contract_id_idx" ON "abnahmen" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abnahmen_project_id_idx" ON "abnahmen" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_project_id_idx" ON "approvals" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_status_idx" ON "approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_due_date_idx" ON "approvals" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_workspace_id_idx" ON "audit_logs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_project_id_idx" ON "audit_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contracts_project_id_idx" ON "contracts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contracts_status_idx" ON "contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_line_items_snapshot_id_idx" ON "cost_line_items" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_line_items_cost_group_idx" ON "cost_line_items" USING btree ("cost_group_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_snapshots_project_id_idx" ON "cost_snapshots" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_snapshots_stage_idx" ON "cost_snapshots" USING btree ("cost_stage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_project_id_idx" ON "documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_messages_workspace_id_idx" ON "inbox_messages" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inbox_messages_status_idx" ON "inbox_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lv_project_id_idx" ON "leistungsverzeichnisse" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lv_positionen_lv_id_idx" ON "lv_positionen" USING btree ("lv_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nachtraege_contract_id_idx" ON "nachtraege" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nachtraege_project_id_idx" ON "nachtraege" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nachtraege_status_idx" ON "nachtraege" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_read_idx" ON "notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "participants_project_id_idx" ON "participants" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "participants_email_idx" ON "participants" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_contract_id_idx" ON "payments" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_project_id_idx" ON "payments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_descriptions_project_id_idx" ON "project_descriptions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_versions_project_id_idx" ON "project_versions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_workspace_id_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_lifecycle_state_idx" ON "projects" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regulatory_submissions_project_id_idx" ON "regulatory_submissions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regulatory_submissions_area_idx" ON "regulatory_submissions" USING btree ("area");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regulatory_submissions_status_idx" ON "regulatory_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_submissions_project_id_idx" ON "review_submissions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_submissions_status_idx" ON "review_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_project_id_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_phase_id_idx" ON "tasks" USING btree ("phase_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_due_date_idx" ON "tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tender_releases_project_id_idx" ON "tender_releases" USING btree ("project_id");