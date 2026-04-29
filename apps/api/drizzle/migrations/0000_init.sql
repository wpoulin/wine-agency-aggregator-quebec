CREATE TABLE IF NOT EXISTS "aggregation_runs" (
	"id" text NOT NULL,
	"agency_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"fetched" integer DEFAULT 0 NOT NULL,
	"normalized" integer DEFAULT 0 NOT NULL,
	"upserted" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"error" text,
	CONSTRAINT "aggregation_runs_id_agency_id_pk" PRIMARY KEY("id","agency_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wines" (
	"id" text PRIMARY KEY NOT NULL,
	"agency_id" text NOT NULL,
	"agency_sku" text NOT NULL,
	"name" text NOT NULL,
	"producer" text,
	"vintage" integer,
	"color" text NOT NULL,
	"country" text,
	"region" text,
	"appellation" text,
	"grapes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"volume_ml" integer,
	"alcohol_pct" numeric(4, 2),
	"price_amount" numeric(10, 2),
	"price_currency" text,
	"available" boolean DEFAULT true NOT NULL,
	"source_url" text,
	"image_url" text,
	"raw" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aggregation_runs_agency_idx" ON "aggregation_runs" USING btree ("agency_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wines_agency_sku_unique" ON "wines" USING btree ("agency_id","agency_sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wines_color_idx" ON "wines" USING btree ("color");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wines_country_idx" ON "wines" USING btree ("country");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wines_name_idx" ON "wines" USING btree ("name");