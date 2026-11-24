-- CreateEnum
CREATE TYPE "GameQuestStatus" AS ENUM ('active', 'rewarded', 'cancelled');

-- CreateTable
CREATE TABLE "game_profiles" (
    "member_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "avatar" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "game_profiles_pkey" PRIMARY KEY ("member_id")
);

-- CreateTable
CREATE TABLE "game_quest_progress" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "quest_key" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "status" "GameQuestStatus" NOT NULL DEFAULT 'active',
    "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewarded_at" TIMESTAMPTZ,

    CONSTRAINT "game_quest_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_ledger" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "source_key" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "crystals" INTEGER NOT NULL DEFAULT 0,
    "materials" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "minigame_sessions" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "game" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "deck" SMALLINT[],
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "moves" INTEGER,
    "score" INTEGER,
    "duration_ms" INTEGER,

    CONSTRAINT "minigame_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_profiles_family_id_idx" ON "game_profiles"("family_id");

-- CreateIndex
CREATE INDEX "game_quest_progress_family_id_idx" ON "game_quest_progress"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_quest_progress_member_id_quest_key_period_key_key" ON "game_quest_progress"("member_id", "quest_key", "period_key");

-- CreateIndex
CREATE INDEX "game_ledger_family_id_idx" ON "game_ledger"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_ledger_member_id_source_key_key" ON "game_ledger"("member_id", "source_key");

-- CreateIndex
CREATE INDEX "minigame_sessions_member_id_game_started_at_idx" ON "minigame_sessions"("member_id", "game", "started_at");

-- CreateIndex
CREATE INDEX "minigame_sessions_family_id_idx" ON "minigame_sessions"("family_id");

-- AddForeignKey
ALTER TABLE "game_profiles" ADD CONSTRAINT "game_profiles_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_profiles" ADD CONSTRAINT "game_profiles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_quest_progress" ADD CONSTRAINT "game_quest_progress_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_quest_progress" ADD CONSTRAINT "game_quest_progress_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_ledger" ADD CONSTRAINT "game_ledger_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_ledger" ADD CONSTRAINT "game_ledger_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minigame_sessions" ADD CONSTRAINT "minigame_sessions_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minigame_sessions" ADD CONSTRAINT "minigame_sessions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
