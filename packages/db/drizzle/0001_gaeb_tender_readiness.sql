CREATE TYPE "public"."bauvorlv_document_category" AS ENUM('cadastral_map', 'site_plan', 'construction_drawings', 'structural_proofs', 'fire_protection_plan', 'noise_heat_insulation', 'other');--> statement-breakpoint
CREATE TYPE "public"."construction_diary_status" AS ENUM('draft', 'signed_off', 'disputed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "construction_diary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"weather_data" jsonb,
	"personnel_on_site" jsonb DEFAULT '[]'::jsonb,
	"defects_logged" jsonb DEFAULT '[]'::jsonb,
	"photo_evidence_refs" jsonb DEFAULT '[]'::jsonb,
	"activities_performed" text,
	"status" "construction_diary_status" DEFAULT 'draft' NOT NULL,
	"signed_off_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bidders" ADD COLUMN "crafts_register_valid" boolean;--> statement-breakpoint
ALTER TABLE "bidders" ADD COLUMN "a1_certificate_valid" boolean;--> statement-breakpoint
ALTER TABLE "bidders" ADD COLUMN "pq_verein_status" boolean;--> statement-breakpoint
ALTER TABLE "bidders" ADD COLUMN "compliance_expiry_date" date;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN "din276_confidence" integer;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN "din276_source" varchar(16);--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN "din276_rationale" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "bauvorlv_category" "bauvorlv_document_category";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "document_date" date;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "scale_metric" varchar(50);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "has_certified_signature" boolean;--> statement-breakpoint
ALTER TABLE "leistungsverzeichnisse" ADD COLUMN "parent_lv_id" uuid;--> statement-breakpoint
ALTER TABLE "leistungsverzeichnisse" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "lv_positionen" ADD COLUMN "din276_confidence" integer;--> statement-breakpoint
ALTER TABLE "lv_positionen" ADD COLUMN "din276_source" varchar(16);--> statement-breakpoint
ALTER TABLE "lv_positionen" ADD COLUMN "din276_rationale" text;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "crafts_register_valid" boolean;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "a1_certificate_valid" boolean;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "pq_verein_status" boolean;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "compliance_expiry_date" date;--> statement-breakpoint
ALTER TABLE "tender_releases" ADD COLUMN "gaeb_math_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tender_releases" ADD COLUMN "gaeb_math_errors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tender_releases" ADD COLUMN "gaeb_math_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tender_releases" ADD COLUMN "math_override_reason" text;--> statement-breakpoint
ALTER TABLE "tender_releases" ADD COLUMN "math_override_by" uuid;--> statement-breakpoint
ALTER TABLE "tender_releases" ADD COLUMN "math_override_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "construction_diary_entries" ADD CONSTRAINT "construction_diary_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "construction_diary_entries" ADD CONSTRAINT "construction_diary_entries_signed_off_by_users_id_fk" FOREIGN KEY ("signed_off_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "construction_diary_entries_project_id_idx" ON "construction_diary_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "construction_diary_entries_entry_date_idx" ON "construction_diary_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "construction_diary_entries_status_idx" ON "construction_diary_entries" USING btree ("status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_releases" ADD CONSTRAINT "tender_releases_math_override_by_users_id_fk" FOREIGN KEY ("math_override_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lv_parent_id_idx" ON "leistungsverzeichnisse" USING btree ("parent_lv_id");