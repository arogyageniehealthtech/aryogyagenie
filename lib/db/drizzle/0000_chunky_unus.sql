-- Ensure PostGIS spatial and pgvector extensions exist before table creation
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"avatar_url" text,
	"date_of_birth" text,
	"age" text,
	"gender" text,
	"address" text,
	"city" text,
	"state" text,
	"blood_group" text,
	"allergies" text,
	"existing_conditions" text,
	"current_medications" text,
	"previous_illnesses" text,
	"emergency_contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"specialty" text NOT NULL,
	"qualification" text,
	"license_number" text,
	"clinic_name" text,
	"clinic_address" text,
	"consultation_fee" real,
	"experience" integer,
	"bio" text,
	"rating" real DEFAULT 0,
	"review_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"available_days" text,
	"available_hours" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doctors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"appointment_date" date NOT NULL,
	"appointment_time" text NOT NULL,
	"type" text DEFAULT 'in_person' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"symptoms" text,
	"notes" text,
	"consultation_fee" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"appointment_id" integer,
	"pharmacy_id" integer,
	"medicines" text NOT NULL,
	"diagnosis" text,
	"instructions" text,
	"file_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"prescribed_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"diagnostic_center_id" integer,
	"test_name" text NOT NULL,
	"test_date" date NOT NULL,
	"file_url" text,
	"ai_summary" text,
	"results" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnostic_centers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"city" text,
	"accreditation" text,
	"services" text,
	"opening_hours" text,
	"rating" real DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diagnostic_centers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "diagnostic_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"diagnostic_center_id" integer NOT NULL,
	"test_name" text NOT NULL,
	"booking_date" date NOT NULL,
	"booking_time" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"price" real,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicine_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"medicine_name" text NOT NULL,
	"dosage" text NOT NULL,
	"frequency" text NOT NULL,
	"times" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"instructions" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"reference_id" integer,
	"event_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symptom_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"symptoms" text NOT NULL,
	"severity" text,
	"duration" text,
	"ai_response" text,
	"possible_conditions" text,
	"recommended_action" text,
	"urgency_level" text,
	"assessment_status" text,
	"recommended_specialty" text,
	"follow_up_questions" jsonb,
	"follow_up_answers" jsonb,
	"risk_factors" jsonb,
	"structured_assessment" jsonb,
	"sources" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacies" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"city" text,
	"license_number" text,
	"opening_hours" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pharmacies_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "health_episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"summary" text,
	"event_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_ai_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"summary_type" text DEFAULT 'patient_overview' NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Ensure pgvector extension exists before creating or referencing vector columns
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE "knowledge_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'general_medicine' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"section" text,
	"page" text,
	"source" text,
	"metadata" jsonb NOT NULL,
	"embedding" jsonb NOT NULL,
	"embedding_vector" vector(768),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"title" text NOT NULL,
	"source" text,
	"publisher" text,
	"document_type" text DEFAULT 'clinical_guideline',
	"version" text DEFAULT '1.0',
	"file_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_documents_document_id_unique" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "provider_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"user_id" integer,
	"first_name" text,
	"last_name" text,
	"name" text,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"specialty" text,
	"address" text,
	"city" text,
	"details" text,
	"rejection_reason" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "health_episodes" ADD CONSTRAINT "health_episodes_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_ai_summaries" ADD CONSTRAINT "patient_ai_summaries_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_appointments_patient_id" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_doctor_id" ON "appointments" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_status" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_appointments_date" ON "appointments" USING btree ("appointment_date");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_patient_id" ON "prescriptions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_doctor_id" ON "prescriptions" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_pharmacy_id" ON "prescriptions" USING btree ("pharmacy_id");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_status" ON "prescriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_lab_reports_patient_id" ON "lab_reports" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_lab_reports_status" ON "lab_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_bookings_patient_id" ON "diagnostic_bookings" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_bookings_center_id" ON "diagnostic_bookings" USING btree ("diagnostic_center_id");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_bookings_status" ON "diagnostic_bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_medicine_reminders_patient_id" ON "medicine_reminders" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_timeline_events_patient_id" ON "timeline_events" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_timeline_events_date" ON "timeline_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "idx_symptom_assessments_patient_id" ON "symptom_assessments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_document_id" ON "knowledge_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_category" ON "knowledge_chunks" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_embedding_hnsw" ON "knowledge_chunks" USING hnsw ("embedding_vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_provider_applications_status" ON "provider_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_provider_applications_email" ON "provider_applications" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_provider_applications_user_id" ON "provider_applications" USING btree ("user_id");