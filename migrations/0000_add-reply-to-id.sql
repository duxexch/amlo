CREATE TABLE "account_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"bio" text,
	"account_referral_code" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" varchar NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" varchar,
	"details" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'moderator' NOT NULL,
	"avatar" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admins_username_unique" UNIQUE("username"),
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "agent_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"bio" text,
	"photo_url" text,
	"whatsapp" text,
	"telegram" text,
	"instagram" text,
	"twitter" text,
	"account_type" text DEFAULT 'agent' NOT NULL,
	"referral_code" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"referral_code" text NOT NULL,
	"commission_rate" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"total_users" integer DEFAULT 0 NOT NULL,
	"total_revenue" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agents_email_unique" UNIQUE("email"),
	CONSTRAINT "agents_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "announcement_popups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"title" text,
	"subtitle" text,
	"buttons" text DEFAULT '[]',
	"show_once" boolean DEFAULT true NOT NULL,
	"delay_seconds" integer DEFAULT 3 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banned_words" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"word" text NOT NULL,
	"language" text DEFAULT 'all' NOT NULL,
	"severity" text DEFAULT 'block' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caller_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'ringing' NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"coins_charged" integer DEFAULT 0 NOT NULL,
	"coin_rate" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_blocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" varchar NOT NULL,
	"blocked_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_chat_blocks" UNIQUE("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "coin_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coins" integer NOT NULL,
	"bonus_coins" integer DEFAULT 0 NOT NULL,
	"price_usd" numeric(10, 2) NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant1_id" varchar NOT NULL,
	"participant2_id" varchar NOT NULL,
	"last_message_id" varchar,
	"last_message_at" timestamp,
	"participant1_unread" integer DEFAULT 0 NOT NULL,
	"participant2_unread" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "featured_streams_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"title_ar" text,
	"streamer_name" text NOT NULL,
	"image" text NOT NULL,
	"stream_id" varchar,
	"viewer_count" integer DEFAULT 0 NOT NULL,
	"is_live" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fraud_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"agent_id" varchar,
	"type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"description" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_profile_visibility" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"friend_id" varchar NOT NULL,
	"visible_profile_index" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_friend_profile_vis" UNIQUE("user_id","friend_id")
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_friendships" UNIQUE("sender_id","receiver_id")
);
--> statement-breakpoint
CREATE TABLE "gift_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"gift_id" varchar NOT NULL,
	"stream_id" varchar,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total_price" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gifts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_ar" text NOT NULL,
	"icon" text NOT NULL,
	"price" integer NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"avatar" text,
	"description" text,
	"creator_id" varchar NOT NULL,
	"max_members" integer DEFAULT 200 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"muted_until" timestamp,
	CONSTRAINT "uq_group_members" UNIQUE("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "group_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"content" text,
	"type" text DEFAULT 'text' NOT NULL,
	"media_url" text,
	"gift_id" varchar,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" varchar NOT NULL,
	"message_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL,
	"reported_user_id" varchar NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"content" text,
	"type" text DEFAULT 'text' NOT NULL,
	"media_url" text,
	"gift_id" varchar,
	"reply_to_id" varchar,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"coins_cost" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"messages" boolean DEFAULT true NOT NULL,
	"calls" boolean DEFAULT true NOT NULL,
	"friend_requests" boolean DEFAULT true NOT NULL,
	"gifts" boolean DEFAULT true NOT NULL,
	"streams" boolean DEFAULT true NOT NULL,
	"system_updates" boolean DEFAULT true NOT NULL,
	"marketing" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"type" text DEFAULT 'manual' NOT NULL,
	"icon" text,
	"instructions" text,
	"instructions_ar" text,
	"account_details" text,
	"min_amount" numeric(12, 2) DEFAULT '1.00',
	"max_amount" numeric(12, 2) DEFAULT '10000.00',
	"currency" text DEFAULT 'USD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text DEFAULT 'image' NOT NULL,
	"media_url" text,
	"text_content" text,
	"bg_color" text,
	"caption" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" varchar NOT NULL,
	"viewer_id" varchar NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_story_views" UNIQUE("story_id","viewer_id")
);
--> statement-breakpoint
CREATE TABLE "stream_banned_words" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" varchar NOT NULL,
	"word" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_muted_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"muted_by" varchar NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_polls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" varchar NOT NULL,
	"question" text NOT NULL,
	"options" text NOT NULL,
	"votes" text DEFAULT '{}' NOT NULL,
	"voter_ids" text DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_viewers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	CONSTRAINT "uq_stream_viewers" UNIQUE("stream_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "streams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text,
	"type" text DEFAULT 'live' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"category" text,
	"viewer_count" integer DEFAULT 0 NOT NULL,
	"peak_viewers" integer DEFAULT 0 NOT NULL,
	"total_gifts" integer DEFAULT 0 NOT NULL,
	"tags" text,
	"pinned_message" text,
	"recording_url" text,
	"scheduled_at" timestamp,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"config_data" text DEFAULT '{}' NOT NULL,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "upgrade_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"current_level" integer NOT NULL,
	"requested_level" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" varchar NOT NULL,
	"following_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_follows" UNIQUE("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"profile_index" integer NOT NULL,
	"pin_hash" text NOT NULL,
	"display_name" text,
	"avatar" text,
	"bio" text,
	"gender" text,
	"country" text,
	"birth_date" date,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_profiles" UNIQUE("user_id","profile_index")
);
--> statement-breakpoint
CREATE TABLE "user_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" varchar NOT NULL,
	"reported_id" varchar NOT NULL,
	"stream_id" varchar,
	"type" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"display_name" text,
	"avatar" text,
	"bio" text,
	"coins" integer DEFAULT 0 NOT NULL,
	"diamonds" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"gender" text,
	"country" text,
	"birth_date" date,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"status" text DEFAULT 'offline' NOT NULL,
	"referral_code" text,
	"referred_by_agent" varchar,
	"interests" text,
	"can_stream" boolean DEFAULT true NOT NULL,
	"miles" integer DEFAULT 0 NOT NULL,
	"total_world_sessions" integer DEFAULT 0 NOT NULL,
	"google_id" text,
	"facebook_id" text,
	"apple_id" text,
	"two_factor_secret" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"last_online_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"currency" text DEFAULT 'coins' NOT NULL,
	"description" text,
	"reference_id" varchar,
	"payment_method" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawal_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"amount_usd" numeric(12, 2),
	"payment_method_id" varchar,
	"payment_details" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"processed_by" varchar,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"content" text,
	"type" text DEFAULT 'text' NOT NULL,
	"media_url" text,
	"gift_id" varchar,
	"coins_cost" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_pricing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filter_type" text NOT NULL,
	"price_coins" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"description_ar" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "world_pricing_filter_type_unique" UNIQUE("filter_type")
);
--> statement-breakpoint
CREATE TABLE "world_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"matched_user_id" varchar,
	"gender_filter" text,
	"age_min" integer DEFAULT 18 NOT NULL,
	"age_max" integer DEFAULT 60 NOT NULL,
	"country_filter" text,
	"chat_type" text DEFAULT 'text' NOT NULL,
	"coins_spent" integer DEFAULT 0 NOT NULL,
	"miles_earned" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'searching' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"matched_at" timestamp,
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_caller_id_users_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant1_id_users_id_fk" FOREIGN KEY ("participant1_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant2_id_users_id_fk" FOREIGN KEY ("participant2_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "featured_streams_config" ADD CONSTRAINT "featured_streams_config_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_profile_visibility" ADD CONSTRAINT "friend_profile_visibility_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_profile_visibility" ADD CONSTRAINT "friend_profile_visibility_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_transactions" ADD CONSTRAINT "gift_transactions_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_transactions" ADD CONSTRAINT "gift_transactions_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_transactions" ADD CONSTRAINT "gift_transactions_gift_id_gifts_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_transactions" ADD CONSTRAINT "gift_transactions_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_conversations" ADD CONSTRAINT "group_conversations_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_group_conversations_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_group_id_group_conversations_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_gift_id_gifts_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_gift_id_gifts_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_banned_words" ADD CONSTRAINT "stream_banned_words_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_muted_users" ADD CONSTRAINT "stream_muted_users_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_muted_users" ADD CONSTRAINT "stream_muted_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_muted_users" ADD CONSTRAINT "stream_muted_users_muted_by_users_id_fk" FOREIGN KEY ("muted_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_polls" ADD CONSTRAINT "stream_polls_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_viewers" ADD CONSTRAINT "stream_viewers_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_viewers" ADD CONSTRAINT "stream_viewers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upgrade_requests" ADD CONSTRAINT "upgrade_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upgrade_requests" ADD CONSTRAINT "upgrade_requests_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_id_users_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_agent_agents_id_fk" FOREIGN KEY ("referred_by_agent") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_processed_by_admins_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_messages" ADD CONSTRAINT "world_messages_session_id_world_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."world_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_messages" ADD CONSTRAINT "world_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_messages" ADD CONSTRAINT "world_messages_gift_id_gifts_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_sessions" ADD CONSTRAINT "world_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_sessions" ADD CONSTRAINT "world_sessions_matched_user_id_users_id_fk" FOREIGN KEY ("matched_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_apps_status_idx" ON "account_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "account_apps_created_idx" ON "account_applications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_logs_admin_idx" ON "admin_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "admin_logs_created_idx" ON "admin_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_apps_status_idx" ON "agent_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_apps_email_idx" ON "agent_applications" USING btree ("email");--> statement-breakpoint
CREATE INDEX "agent_apps_created_idx" ON "agent_applications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agents_status_idx" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agents_referral_code_idx" ON "agents" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "banned_words_word_idx" ON "banned_words" USING btree ("word");--> statement-breakpoint
CREATE INDEX "calls_caller_idx" ON "calls" USING btree ("caller_id");--> statement-breakpoint
CREATE INDEX "calls_receiver_idx" ON "calls" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "calls_status_idx" ON "calls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "calls_created_idx" ON "calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_blocks_blocker_idx" ON "chat_blocks" USING btree ("blocker_id");--> statement-breakpoint
CREATE INDEX "chat_blocks_blocked_idx" ON "chat_blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "coin_packages_active_sort_idx" ON "coin_packages" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "conv_p1_idx" ON "conversations" USING btree ("participant1_id");--> statement-breakpoint
CREATE INDEX "conv_p2_idx" ON "conversations" USING btree ("participant2_id");--> statement-breakpoint
CREATE INDEX "conv_last_msg_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "fraud_alerts_user_idx" ON "fraud_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fraud_alerts_status_idx" ON "fraud_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fraud_alerts_severity_idx" ON "fraud_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "fraud_alerts_created_idx" ON "fraud_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "fpv_user_idx" ON "friend_profile_visibility" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fpv_friend_idx" ON "friend_profile_visibility" USING btree ("friend_id");--> statement-breakpoint
CREATE INDEX "fpv_user_friend_idx" ON "friend_profile_visibility" USING btree ("user_id","friend_id");--> statement-breakpoint
CREATE INDEX "friendships_sender_idx" ON "friendships" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "friendships_receiver_idx" ON "friendships" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "friendships_status_idx" ON "friendships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gift_tx_sender_idx" ON "gift_transactions" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "gift_tx_receiver_idx" ON "gift_transactions" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "gift_tx_created_idx" ON "gift_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "group_conv_creator_idx" ON "group_conversations" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "group_conv_last_msg_idx" ON "group_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "group_members_group_idx" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_members_user_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "group_msg_group_idx" ON "group_messages" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_msg_sender_idx" ON "group_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "group_msg_created_idx" ON "group_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "msg_reports_reporter_idx" ON "message_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "msg_reports_message_idx" ON "message_reports" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "msg_reports_status_idx" ON "message_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "msg_reports_created_idx" ON "message_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "msg_conv_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "msg_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "msg_created_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notif_prefs_user_idx" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stories_user_idx" ON "stories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stories_expires_idx" ON "stories" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "stories_active_idx" ON "stories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "story_views_story_idx" ON "story_views" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "story_views_viewer_idx" ON "story_views" USING btree ("viewer_id");--> statement-breakpoint
CREATE INDEX "stream_banned_words_stream_idx" ON "stream_banned_words" USING btree ("stream_id");--> statement-breakpoint
CREATE INDEX "stream_muted_users_stream_idx" ON "stream_muted_users" USING btree ("stream_id");--> statement-breakpoint
CREATE INDEX "stream_muted_users_user_idx" ON "stream_muted_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stream_polls_stream_idx" ON "stream_polls" USING btree ("stream_id");--> statement-breakpoint
CREATE INDEX "stream_viewers_stream_idx" ON "stream_viewers" USING btree ("stream_id");--> statement-breakpoint
CREATE INDEX "stream_viewers_user_idx" ON "stream_viewers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "streams_user_idx" ON "streams" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "streams_status_idx" ON "streams" USING btree ("status");--> statement-breakpoint
CREATE INDEX "streams_started_idx" ON "streams" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "streams_category_idx" ON "streams" USING btree ("category");--> statement-breakpoint
CREATE INDEX "streams_scheduled_idx" ON "streams" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "system_config_category_idx" ON "system_config" USING btree ("category");--> statement-breakpoint
CREATE INDEX "upgrade_req_user_idx" ON "upgrade_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "upgrade_req_status_idx" ON "upgrade_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "upgrade_req_created_idx" ON "upgrade_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "follows_follower_idx" ON "user_follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "follows_following_idx" ON "user_follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "user_profiles_user_idx" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_user_index_idx" ON "user_profiles" USING btree ("user_id","profile_index");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "user_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reports_created_idx" ON "user_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_country_idx" ON "users" USING btree ("country");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_is_banned_idx" ON "users" USING btree ("is_banned");--> statement-breakpoint
CREATE INDEX "wallet_tx_user_idx" ON "wallet_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallet_tx_type_idx" ON "wallet_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "wallet_tx_created_idx" ON "wallet_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "withdrawal_user_idx" ON "withdrawal_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "withdrawal_status_idx" ON "withdrawal_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "withdrawal_created_idx" ON "withdrawal_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "world_msg_session_idx" ON "world_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "world_msg_sender_idx" ON "world_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "world_msg_created_idx" ON "world_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "world_pricing_filter_idx" ON "world_pricing" USING btree ("filter_type");--> statement-breakpoint
CREATE INDEX "world_sessions_user_idx" ON "world_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "world_sessions_status_idx" ON "world_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "world_sessions_started_idx" ON "world_sessions" USING btree ("started_at");