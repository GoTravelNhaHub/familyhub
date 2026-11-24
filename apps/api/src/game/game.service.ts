import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { GameQuestStatus, Prisma, type Member, type Task } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { requireParent, resolveFamilyScope } from "../auth/family-scope";
import type { AuthContext } from "../auth/jwt.strategy";
import { readAvatar, type AvatarConfig } from "./avatar";
import { ACHIEVEMENTS, achievementSourceKey, newlyUnlocked, type AchievementReward } from "./achievements";
import {
  dateInTz,
  FAMILY_LEVEL_SCALE,
  isoWeekdayOf,
  levelForXp,
  sumResources,
  unlockedZones,
  type Resources,
} from "./progression";
import {
  periodKeyFor,
  questSourceKey,
  questStatus,
  STATIC_QUESTS,
  taskQuest,
  type QuestDef,
  type QuestStatus,
} from "./quests";
import {
  dealDeck,
  MEMORY_LEVELS,
  memoryLevel,
  memoryReward,
  memoryScore,
  memorySourceKey,
  MIN_MS_PER_PAIR,
  replayFlips,
} from "./memory";

const ACHIEVEMENT_PREFIX = "achievement:";
/** Finished runs (won or not) listed as recent results in the Academy. */
const RECENT_RESULTS = 8;

type Tx = Prisma.TransactionClient;

const DAILY_CHEST_REWARD: Resources = { xp: 5, coins: 10, crystals: 0, materials: 2 };

interface QuestContext {
  today: string;
  defs: QuestDef[];
  progress: Map<string, { id: string; status: GameQuestStatus; acceptedAt: Date }>;
  rewardedOnce: Set<string>;
  completedTaskIds: Set<string>;
  wonSessions: { level: number; finishedAt: Date }[];
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function isTaskDueOn(task: Task, memberId: string, date: string): boolean {
  if (!task.active) return false;
  if (task.startDate.toISOString().slice(0, 10) > date) return false;
  if (task.endDate && task.endDate.toISOString().slice(0, 10) < date) return false;
  if (task.assigneeId && task.assigneeId !== memberId) return false;
  if (task.recurrenceDays.length > 0 && !task.recurrenceDays.includes(isoWeekdayOf(date))) return false;
  return true;
}

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The signed-in user plays as themselves by default. Kids are usually
   * login-less member profiles, so a parent may play as any member of their
   * family; a child may only play as themselves.
   */
  async resolvePlayer(user: AuthContext, familyId: string | undefined, memberId: string | undefined) {
    const scope = resolveFamilyScope(user, familyId);
    const targetId = memberId ?? scope.memberId;
    if (targetId !== scope.memberId) requireParent(scope);
    const member = await this.prisma.member.findUnique({ where: { id: targetId } });
    if (!member || member.familyId !== scope.familyId) throw new NotFoundException("member_not_found");
    return member;
  }

  private async today(familyId: string): Promise<string> {
    const family = await this.prisma.family.findUniqueOrThrow({ where: { id: familyId } });
    return dateInTz(new Date(), family.timezone);
  }

  private async questContext(member: Member): Promise<QuestContext> {
    const today = await this.today(member.familyId);
    const utcToday = new Date().toISOString().slice(0, 10);
    const tasks = await this.prisma.task.findMany({
      where: { familyId: member.familyId, active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const due = tasks.filter((t) => isTaskDueOn(t, member.id, today));
    const defs = [...STATIC_QUESTS, ...due.map(taskQuest)];

    const [rows, completions, wonSessions] = await Promise.all([
      this.prisma.gameQuestProgress.findMany({
        where: { memberId: member.id, OR: [{ periodKey: "once" }, { periodKey: today }] },
      }),
      // The web app has historically stamped completions with the UTC date,
      // so accept either that or the family-local date.
      this.prisma.taskCompletion.findMany({
        where: {
          memberId: member.id,
          taskId: { in: due.map((t) => t.id) },
          completedOn: { in: [new Date(today), new Date(utcToday)] },
        },
        select: { taskId: true },
      }),
      this.prisma.miniGameSession.findMany({
        where: { memberId: member.id, game: "memory", won: true },
        select: { level: true, finishedAt: true },
      }),
    ]);

    const progress = new Map(rows.map((r) => [`${r.questKey}|${r.periodKey}`, r]));
    const rewardedOnce = new Set(
      rows.filter((r) => r.periodKey === "once" && r.status === GameQuestStatus.rewarded).map((r) => r.questKey),
    );
    return {
      today,
      defs,
      progress,
      rewardedOnce,
      completedTaskIds: new Set(completions.map((c) => c.taskId)),
      wonSessions: wonSessions.filter((s): s is { level: number; finishedAt: Date } => !!s.finishedAt),
    };
  }

  private evaluate(def: QuestDef, ctx: QuestContext) {
    const progress = ctx.progress.get(`${def.key}|${periodKeyFor(def, ctx.today)}`);
    const obj = def.objective;
    let conditionMet = false;
    if (progress?.status === GameQuestStatus.active) {
      if (obj.type === "talk") conditionMet = true;
      else if (obj.type === "task") conditionMet = ctx.completedTaskIds.has(obj.taskId);
      else
        conditionMet = ctx.wonSessions.some(
          (s) => s.level >= obj.minLevel && s.finishedAt >= progress.acceptedAt,
        );
    }
    const status: QuestStatus = questStatus({ def, progress, conditionMet, rewardedOnce: ctx.rewardedOnce });
    return { progress, status };
  }

  async getState(member: Member) {
    const [family, members, profiles, sums, ctx, chest, sessions] = await Promise.all([
      this.prisma.family.findUniqueOrThrow({ where: { id: member.familyId } }),
      this.prisma.member.findMany({ where: { familyId: member.familyId }, orderBy: { createdAt: "asc" } }),
      this.prisma.gameProfile.findMany({ where: { familyId: member.familyId } }),
      this.prisma.gameLedgerEntry.groupBy({
        by: ["memberId"],
        where: { familyId: member.familyId },
        _sum: { xp: true, coins: true, crystals: true, materials: true },
      }),
      this.questContext(member),
      this.today(member.familyId).then((today) =>
        this.prisma.gameLedgerEntry.findUnique({
          where: { memberId_sourceKey: { memberId: member.id, sourceKey: `daily:${today}` } },
        }),
      ),
      this.prisma.miniGameSession.findMany({
        where: { memberId: member.id, game: "memory", won: true },
        select: { level: true, score: true },
      }),
    ]);
    const [recent, unlocked] = await Promise.all([
      this.prisma.miniGameSession.findMany({
        where: { memberId: member.id, game: "memory", finishedAt: { not: null } },
        orderBy: { finishedAt: "desc" },
        take: RECENT_RESULTS,
        select: { level: true, won: true, score: true, moves: true, durationMs: true, finishedAt: true },
      }),
      this.prisma.gameLedgerEntry.findMany({
        where: { memberId: member.id, sourceKey: { startsWith: ACHIEVEMENT_PREFIX } },
        select: { sourceKey: true, createdAt: true },
      }),
    ]);

    const avatarOf = (m: Member) =>
      readAvatar(profiles.find((p) => p.memberId === m.id)?.avatar, m.id, m.role);
    const resourcesOf = (id: string): Resources => {
      const s = sums.find((x) => x.memberId === id)?._sum;
      return sumResources(s ? [{ xp: s.xp ?? 0, coins: s.coins ?? 0, crystals: s.crystals ?? 0, materials: s.materials ?? 0 }] : []);
    };
    const familyXp = members.reduce((acc, m) => acc + resourcesOf(m.id).xp, 0);
    const mine = resourcesOf(member.id);
    const myLevel = levelForXp(mine.xp);

    const rewardedToday = await this.prisma.gameLedgerEntry.findMany({
      where: { memberId: member.id, sourceKey: { startsWith: `minigame:memory:${ctx.today}:` } },
      select: { sourceKey: true },
    });
    const maxWon = sessions.reduce((acc, s) => Math.max(acc, s.level), 0);

    return {
      today: ctx.today,
      player: {
        memberId: member.id,
        name: member.name,
        role: member.role,
        color: member.color,
        avatar: avatarOf(member),
        resources: mine,
        level: myLevel,
        zones: unlockedZones(myLevel.level),
      },
      family: {
        name: family.name,
        level: levelForXp(familyXp, FAMILY_LEVEL_SCALE),
        members: members.map((m) => ({
          memberId: m.id,
          name: m.name,
          role: m.role,
          color: m.color,
          avatar: avatarOf(m),
          level: levelForXp(resourcesOf(m.id).xp).level,
        })),
      },
      quests: ctx.defs.map((def) => ({
        key: def.key,
        kind: def.kind,
        npc: def.npc,
        repeat: def.repeat,
        titleKey: def.titleKey,
        descKey: def.descKey,
        params: def.params ?? {},
        reward: def.reward,
        objective: def.objective,
        status: this.evaluate(def, ctx).status,
      })),
      dailyChest: { claimed: !!chest, reward: DAILY_CHEST_REWARD },
      memory: {
        levels: MEMORY_LEVELS.map((l) => ({
          ...l,
          unlocked: l.level <= maxWon + 1,
          rewardedToday: rewardedToday.some((r) => r.sourceKey === memorySourceKey(l.level, ctx.today)),
          best: sessions.filter((s) => s.level === l.level).reduce((acc, s) => Math.max(acc, s.score ?? 0), 0),
          wins: sessions.filter((s) => s.level === l.level).length,
          reward: memoryReward(l),
        })),
        recent: recent.map((r) => ({
          level: r.level,
          won: r.won,
          score: r.score ?? 0,
          moves: r.moves ?? 0,
          durationMs: r.durationMs ?? 0,
          finishedAt: r.finishedAt!.toISOString(),
        })),
      },
      achievements: ACHIEVEMENTS.map((a) => {
        const row = unlocked.find((u) => u.sourceKey === achievementSourceKey(a.key));
        return { key: a.key, reward: a.reward, unlocked: !!row, unlockedAt: row?.createdAt.toISOString() ?? null };
      }),
    };
  }

  async setAvatar(member: Member, avatar: AvatarConfig) {
    await this.prisma.gameProfile.upsert({
      where: { memberId: member.id },
      create: { memberId: member.id, familyId: member.familyId, avatar },
      update: { avatar },
    });
    return { avatar };
  }

  private async findQuest(member: Member, key: string) {
    const ctx = await this.questContext(member);
    const def = ctx.defs.find((d) => d.key === key);
    if (!def) throw new NotFoundException("quest_not_found");
    return { ctx, def, ...this.evaluate(def, ctx) };
  }

  async acceptQuest(member: Member, key: string) {
    const { ctx, def, progress, status } = await this.findQuest(member, key);
    if (status !== "available") throw new BadRequestException(`quest_${status}`);
    const periodKey = periodKeyFor(def, ctx.today);
    if (progress) {
      await this.prisma.gameQuestProgress.update({
        where: { id: progress.id },
        data: { status: GameQuestStatus.active, acceptedAt: new Date() },
      });
    } else {
      try {
        await this.prisma.gameQuestProgress.create({
          data: { familyId: member.familyId, memberId: member.id, questKey: def.key, periodKey },
        });
      } catch (e) {
        if (isUniqueViolation(e)) throw new BadRequestException("quest_active");
        throw e;
      }
    }
    return { ok: true };
  }

  async cancelQuest(member: Member, key: string) {
    const { progress, status } = await this.findQuest(member, key);
    if (!progress || (status !== "active" && status !== "completed")) {
      throw new BadRequestException("quest_not_active");
    }
    await this.prisma.gameQuestProgress.updateMany({
      where: { id: progress.id, status: GameQuestStatus.active },
      data: { status: GameQuestStatus.cancelled },
    });
    return { ok: true };
  }

  async claimQuest(member: Member, key: string) {
    const { ctx, def, progress, status } = await this.findQuest(member, key);
    if (status === "rewarded") throw new BadRequestException("already_claimed");
    if (status !== "completed" || !progress) throw new BadRequestException("quest_not_completed");
    try {
      await this.prisma.$transaction(async (tx) => {
        const flipped = await tx.gameQuestProgress.updateMany({
          where: { id: progress.id, status: GameQuestStatus.active },
          data: { status: GameQuestStatus.rewarded, rewardedAt: new Date() },
        });
        if (flipped.count !== 1) throw new BadRequestException("already_claimed");
        await tx.gameLedgerEntry.create({
          data: {
            familyId: member.familyId,
            memberId: member.id,
            sourceKey: questSourceKey(def, ctx.today),
            ...def.reward,
          },
        });
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new BadRequestException("already_claimed");
      throw e;
    }
    return { reward: def.reward };
  }

  async claimDailyChest(member: Member) {
    const today = await this.today(member.familyId);
    try {
      await this.prisma.gameLedgerEntry.create({
        data: {
          familyId: member.familyId,
          memberId: member.id,
          sourceKey: `daily:${today}`,
          ...DAILY_CHEST_REWARD,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new BadRequestException("already_claimed");
      throw e;
    }
    return { reward: DAILY_CHEST_REWARD };
  }

  async startMemory(member: Member, level: number) {
    const cfg = memoryLevel(level);
    if (!cfg) throw new BadRequestException("invalid_level");
    if (level > 1) {
      const prev = await this.prisma.miniGameSession.findFirst({
        where: { memberId: member.id, game: "memory", won: true, level: { gte: level - 1 } },
      });
      if (!prev) throw new BadRequestException("level_locked");
    }
    const deck = dealDeck(cfg.pairs);
    const session = await this.prisma.miniGameSession.create({
      data: { familyId: member.familyId, memberId: member.id, game: "memory", level, deck },
    });
    return { sessionId: session.id, level, pairs: cfg.pairs, cols: cfg.cols, deck };
  }

  async finishMemory(member: Member, sessionId: string, flips: number[]) {
    const session = await this.prisma.miniGameSession.findUnique({ where: { id: sessionId } });
    if (!session || session.memberId !== member.id || session.game !== "memory") {
      throw new NotFoundException("session_not_found");
    }
    if (session.finishedAt) throw new BadRequestException("session_finished");
    const cfg = memoryLevel(session.level)!;
    const now = new Date();
    const durationMs = now.getTime() - session.startedAt.getTime();
    const replay = replayFlips(session.deck, flips);
    let error = replay.error;
    if (replay.won && durationMs < cfg.pairs * MIN_MS_PER_PAIR) error = "too_fast";
    const won = replay.won && !error;
    const score = won ? memoryScore(cfg, replay.moves, durationMs) : 0;

    const family = await this.prisma.family.findUniqueOrThrow({ where: { id: member.familyId } });

    // Close the session, grant the daily level reward, and grant any newly
    // earned achievements in one transaction. Every grant is a unique ledger
    // row, so replays and concurrent requests cannot pay out twice.
    return this.prisma.$transaction(async (tx) => {
      const closed = await tx.miniGameSession.updateMany({
        where: { id: session.id, finishedAt: null },
        data: { finishedAt: now, won, moves: replay.moves, score, durationMs },
      });
      if (closed.count !== 1) throw new BadRequestException("session_finished");

      let reward: Resources | null = null;
      let achievements: { key: string; reward: AchievementReward }[] = [];
      if (won) {
        const grant = memoryReward(cfg);
        const today = dateInTz(now, family.timezone);
        const created = await tx.gameLedgerEntry.createMany({
          data: [{ familyId: member.familyId, memberId: member.id, sourceKey: memorySourceKey(cfg.level, today), ...grant }],
          // Already rewarded for this level today: the result still counts as practice.
          skipDuplicates: true,
        });
        if (created.count === 1) reward = grant;
        achievements = await this.grantAchievements(tx, member, family.timezone);
      }
      return { won, moves: replay.moves, score, durationMs, reward, achievements, error: error ?? null };
    });
  }

  /** Re-evaluates achievements from all recorded wins and grants the missing ones. */
  private async grantAchievements(tx: Tx, member: Member, timezone: string) {
    const [wins, granted] = await Promise.all([
      tx.miniGameSession.findMany({
        where: { memberId: member.id, game: "memory", won: true, finishedAt: { not: null } },
        select: { level: true, moves: true, durationMs: true, finishedAt: true },
      }),
      tx.gameLedgerEntry.findMany({
        where: { memberId: member.id, sourceKey: { startsWith: ACHIEVEMENT_PREFIX } },
        select: { sourceKey: true },
      }),
    ]);
    const fresh = newlyUnlocked(
      wins.map((w) => ({
        level: w.level,
        pairs: memoryLevel(w.level)?.pairs ?? 0,
        moves: w.moves ?? Number.MAX_SAFE_INTEGER,
        durationMs: w.durationMs ?? Number.MAX_SAFE_INTEGER,
        day: dateInTz(w.finishedAt!, timezone),
      })),
      granted.map((g) => g.sourceKey.slice(ACHIEVEMENT_PREFIX.length)),
    );
    if (fresh.length === 0) return [];
    await tx.gameLedgerEntry.createMany({
      data: fresh.map((a) => ({
        familyId: member.familyId,
        memberId: member.id,
        sourceKey: achievementSourceKey(a.key),
        ...a.reward,
      })),
      skipDuplicates: true,
    });
    return fresh.map((a) => ({ key: a.key, reward: a.reward }));
  }
}
