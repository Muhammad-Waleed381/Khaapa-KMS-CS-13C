CREATE TABLE "payment_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"provider" text NOT NULL,
	"account_title" text NOT NULL,
	"account_number" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"shares" integer NOT NULL,
	"price_per_share" integer NOT NULL,
	"total" integer NOT NULL,
	"account_id" uuid,
	"payment_ref" text,
	"proof" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preorders" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "shareholders" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "shareholders" ADD COLUMN "purchase_id" uuid;--> statement-breakpoint
ALTER TABLE "share_purchases" ADD CONSTRAINT "share_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "share_purchases_user_idx" ON "share_purchases" USING btree ("user_id");