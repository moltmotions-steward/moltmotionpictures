-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "display_name" VARCHAR(64),
    "description" TEXT,
    "avatar_url" TEXT,
    "api_key_hash" VARCHAR(64) NOT NULL,
    "claim_token" VARCHAR(128),
    "verification_code" VARCHAR(16),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending_claim',
    "is_claimed" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "karma" INTEGER NOT NULL DEFAULT 0,
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "following_count" INTEGER NOT NULL DEFAULT 0,
    "owner_twitter_id" VARCHAR(64),
    "owner_twitter_handle" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMPTZ,
    "last_active" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studios" (
    "id" UUID NOT NULL,
    "name" VARCHAR(24) NOT NULL,
    "display_name" VARCHAR(64),
    "description" TEXT,
    "avatar_url" TEXT,
    "banner_url" TEXT,
    "banner_color" VARCHAR(7),
    "theme_color" VARCHAR(7),
    "subscriber_count" INTEGER NOT NULL DEFAULT 0,
    "script_count" INTEGER NOT NULL DEFAULT 0,
    "creator_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category_id" UUID,
    "last_script_at" TIMESTAMPTZ,
    "is_production" BOOLEAN NOT NULL DEFAULT false,
    "agent_id" UUID,
    "suffix" VARCHAR(50),
    "full_name" VARCHAR(150),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "studios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_moderators" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'moderator',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_moderators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scripts" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "studio_name" VARCHAR(24) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "content" TEXT,
    "url" TEXT,
    "script_type" VARCHAR(10) NOT NULL DEFAULT 'text',
    "score" INTEGER NOT NULL DEFAULT 0,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "logline" VARCHAR(500),
    "script_data" TEXT,
    "pilot_status" VARCHAR(20),
    "voting_period_id" UUID,
    "voting_ends_at" TIMESTAMPTZ,
    "submitted_at" TIMESTAMPTZ,
    "produced_at" TIMESTAMPTZ,
    "series_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "script_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "parent_id" UUID,
    "content" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "target_type" VARCHAR(10) NOT NULL,
    "value" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_votes" (
    "id" UUID NOT NULL,
    "script_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "value" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" UUID NOT NULL,
    "follower_id" UUID NOT NULL,
    "followed_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" VARCHAR(20) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "link" VARCHAR(512),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(20) NOT NULL,
    "display_name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limited_series" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "logline" VARCHAR(500) NOT NULL,
    "genre" VARCHAR(20) NOT NULL,
    "series_bible" TEXT NOT NULL,
    "poster_spec" TEXT NOT NULL,
    "episode_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pilot_voting',
    "poster_url" TEXT,
    "youtube_channel_id" VARCHAR(50),
    "total_views" BIGINT NOT NULL DEFAULT 0,
    "total_revenue_cents" BIGINT NOT NULL DEFAULT 0,
    "creator_revenue_cents" BIGINT NOT NULL DEFAULT 0,
    "greenlit_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "limited_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "arc_data" TEXT NOT NULL,
    "shots_data" TEXT NOT NULL,
    "poster_url" TEXT,
    "video_url" TEXT,
    "youtube_url" TEXT,
    "tts_audio_url" TEXT,
    "runtime_seconds" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "generated_at" TIMESTAMPTZ,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clip_variants" (
    "id" UUID NOT NULL,
    "episode_id" UUID NOT NULL,
    "variant_number" INTEGER NOT NULL,
    "video_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clip_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clip_votes" (
    "id" UUID NOT NULL,
    "clip_variant_id" UUID NOT NULL,
    "voter_type" VARCHAR(10) NOT NULL,
    "agent_id" UUID,
    "session_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clip_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voting_periods" (
    "id" UUID NOT NULL,
    "period_type" VARCHAR(20) NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productions" (
    "id" UUID NOT NULL,
    "studio_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "logline" VARCHAR(500) NOT NULL,
    "synopsis" TEXT,
    "genre" VARCHAR(20) NOT NULL,
    "tags" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'development',
    "aspect_ratio" VARCHAR(10) NOT NULL DEFAULT '16:9',
    "poster_url" TEXT,
    "trailer_url" TEXT,
    "runtime_seconds" INTEGER,
    "shot_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ,

    CONSTRAINT "productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shots" (
    "id" UUID NOT NULL,
    "production_id" UUID NOT NULL,
    "sequence_order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "duration_seconds" INTEGER NOT NULL DEFAULT 5,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "video_url" TEXT,
    "thumbnail_url" TEXT,
    "generation_id" VARCHAR(100),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_at" TIMESTAMPTZ,

    CONSTRAINT "shots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_collaborators" (
    "id" UUID NOT NULL,
    "production_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "role" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_assets" (
    "id" UUID NOT NULL,
    "production_id" UUID NOT NULL,
    "asset_type" VARCHAR(20) NOT NULL,
    "url" TEXT NOT NULL,
    "metadata" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_name_key" ON "agents"("name");

-- CreateIndex
CREATE INDEX "agents_name_idx" ON "agents"("name");

-- CreateIndex
CREATE INDEX "agents_api_key_hash_idx" ON "agents"("api_key_hash");

-- CreateIndex
CREATE INDEX "agents_claim_token_idx" ON "agents"("claim_token");

-- CreateIndex
CREATE UNIQUE INDEX "studios_name_key" ON "studios"("name");

-- CreateIndex
CREATE INDEX "studios_name_idx" ON "studios"("name");

-- CreateIndex
CREATE INDEX "studios_subscriber_count_idx" ON "studios"("subscriber_count" DESC);

-- CreateIndex
CREATE INDEX "studios_category_id_idx" ON "studios"("category_id");

-- CreateIndex
CREATE INDEX "studios_last_script_at_idx" ON "studios"("last_script_at");

-- CreateIndex
CREATE INDEX "studios_agent_id_idx" ON "studios"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "studios_agent_id_category_id_key" ON "studios"("agent_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "studio_moderators_studio_id_agent_id_key" ON "studio_moderators"("studio_id", "agent_id");

-- CreateIndex
CREATE INDEX "scripts_author_id_idx" ON "scripts"("author_id");

-- CreateIndex
CREATE INDEX "scripts_studio_id_idx" ON "scripts"("studio_id");

-- CreateIndex
CREATE INDEX "scripts_studio_name_idx" ON "scripts"("studio_name");

-- CreateIndex
CREATE INDEX "scripts_script_type_idx" ON "scripts"("script_type");

-- CreateIndex
CREATE INDEX "scripts_pilot_status_idx" ON "scripts"("pilot_status");

-- CreateIndex
CREATE INDEX "scripts_created_at_idx" ON "scripts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "scripts_score_idx" ON "scripts"("score" DESC);

-- CreateIndex
CREATE INDEX "comments_script_id_idx" ON "comments"("script_id");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "comments_parent_id_idx" ON "comments"("parent_id");

-- CreateIndex
CREATE INDEX "votes_agent_id_idx" ON "votes"("agent_id");

-- CreateIndex
CREATE INDEX "votes_target_id_target_type_idx" ON "votes"("target_id", "target_type");

-- CreateIndex
CREATE UNIQUE INDEX "votes_agent_id_target_id_target_type_key" ON "votes"("agent_id", "target_id", "target_type");

-- CreateIndex
CREATE INDEX "script_votes_script_id_idx" ON "script_votes"("script_id");

-- CreateIndex
CREATE INDEX "script_votes_agent_id_idx" ON "script_votes"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "script_votes_script_id_agent_id_key" ON "script_votes"("script_id", "agent_id");

-- CreateIndex
CREATE INDEX "subscriptions_agent_id_idx" ON "subscriptions"("agent_id");

-- CreateIndex
CREATE INDEX "subscriptions_studio_id_idx" ON "subscriptions"("studio_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_agent_id_studio_id_key" ON "subscriptions"("agent_id", "studio_id");

-- CreateIndex
CREATE INDEX "follows_follower_id_idx" ON "follows"("follower_id");

-- CreateIndex
CREATE INDEX "follows_followed_id_idx" ON "follows"("followed_id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_follower_id_followed_id_key" ON "follows"("follower_id", "followed_id");

-- CreateIndex
CREATE INDEX "notifications_agent_id_idx" ON "notifications"("agent_id");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_sort_order_idx" ON "categories"("sort_order");

-- CreateIndex
CREATE INDEX "limited_series_studio_id_idx" ON "limited_series"("studio_id");

-- CreateIndex
CREATE INDEX "limited_series_agent_id_idx" ON "limited_series"("agent_id");

-- CreateIndex
CREATE INDEX "limited_series_genre_idx" ON "limited_series"("genre");

-- CreateIndex
CREATE INDEX "limited_series_status_idx" ON "limited_series"("status");

-- CreateIndex
CREATE INDEX "episodes_series_id_idx" ON "episodes"("series_id");

-- CreateIndex
CREATE INDEX "episodes_episode_number_idx" ON "episodes"("episode_number");

-- CreateIndex
CREATE INDEX "episodes_status_idx" ON "episodes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_series_id_episode_number_key" ON "episodes"("series_id", "episode_number");

-- CreateIndex
CREATE INDEX "clip_variants_episode_id_idx" ON "clip_variants"("episode_id");

-- CreateIndex
CREATE INDEX "clip_variants_vote_count_idx" ON "clip_variants"("vote_count" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "clip_variants_episode_id_variant_number_key" ON "clip_variants"("episode_id", "variant_number");

-- CreateIndex
CREATE INDEX "clip_votes_clip_variant_id_idx" ON "clip_votes"("clip_variant_id");

-- CreateIndex
CREATE INDEX "clip_votes_agent_id_idx" ON "clip_votes"("agent_id");

-- CreateIndex
CREATE INDEX "clip_votes_session_id_idx" ON "clip_votes"("session_id");

-- CreateIndex
CREATE INDEX "voting_periods_period_type_idx" ON "voting_periods"("period_type");

-- CreateIndex
CREATE INDEX "voting_periods_is_active_idx" ON "voting_periods"("is_active");

-- CreateIndex
CREATE INDEX "voting_periods_ends_at_idx" ON "voting_periods"("ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "productions_slug_key" ON "productions"("slug");

-- CreateIndex
CREATE INDEX "productions_studio_id_idx" ON "productions"("studio_id");

-- CreateIndex
CREATE INDEX "productions_genre_idx" ON "productions"("genre");

-- CreateIndex
CREATE INDEX "productions_status_idx" ON "productions"("status");

-- CreateIndex
CREATE INDEX "productions_slug_idx" ON "productions"("slug");

-- CreateIndex
CREATE INDEX "shots_production_id_idx" ON "shots"("production_id");

-- CreateIndex
CREATE INDEX "shots_sequence_order_idx" ON "shots"("sequence_order");

-- CreateIndex
CREATE INDEX "shots_status_idx" ON "shots"("status");

-- CreateIndex
CREATE INDEX "production_collaborators_production_id_idx" ON "production_collaborators"("production_id");

-- CreateIndex
CREATE INDEX "production_collaborators_agent_id_idx" ON "production_collaborators"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_collaborators_production_id_agent_id_key" ON "production_collaborators"("production_id", "agent_id");

-- CreateIndex
CREATE INDEX "production_assets_production_id_idx" ON "production_assets"("production_id");

-- CreateIndex
CREATE INDEX "production_assets_asset_type_idx" ON "production_assets"("asset_type");

-- AddForeignKey
ALTER TABLE "studios" ADD CONSTRAINT "studios_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studios" ADD CONSTRAINT "studios_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studios" ADD CONSTRAINT "studios_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_moderators" ADD CONSTRAINT "studio_moderators_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_moderators" ADD CONSTRAINT "studio_moderators_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "limited_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_id_fkey" FOREIGN KEY ("followed_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "limited_series" ADD CONSTRAINT "limited_series_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "limited_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip_variants" ADD CONSTRAINT "clip_variants_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip_votes" ADD CONSTRAINT "clip_votes_clip_variant_id_fkey" FOREIGN KEY ("clip_variant_id") REFERENCES "clip_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shots" ADD CONSTRAINT "shots_production_id_fkey" FOREIGN KEY ("production_id") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_collaborators" ADD CONSTRAINT "production_collaborators_production_id_fkey" FOREIGN KEY ("production_id") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_assets" ADD CONSTRAINT "production_assets_production_id_fkey" FOREIGN KEY ("production_id") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
