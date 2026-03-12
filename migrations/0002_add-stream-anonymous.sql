ALTER TABLE "streams" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN "anonymous_name" text;