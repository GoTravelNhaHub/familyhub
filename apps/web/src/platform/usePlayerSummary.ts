import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { auth } from "../lib/api";
import { useMe } from "../hooks/useAuth";
import { gameApi, gameKeys } from "../game/gameApi";
import { GUEST_DEFAULT_AVATAR, guestBackend, hasGuestProgress } from "../game/guest";
import type { AvatarConfig } from "../game/avatar";
import type { GameMember, GameState, LevelInfo, Resources } from "../game/types";
import type { MemberRole } from "../lib/types";

export interface PlayerSummary {
  guest: boolean;
  name: string;
  avatar: AvatarConfig;
  level: LevelInfo;
  resources: Resources;
  /** Quests ready to claim or start. */
  questsWaiting: number;
  /** Has this player made any progress yet? Drives "Continue" vs "Play now". */
  started: boolean;
  role?: MemberRole;
  family?: { name: string; level: number; members: GameMember[] };
}

const EMPTY_LEVEL: LevelInfo = { level: 1, xp: 0, intoLevel: 0, span: 100 };
const NO_RESOURCES: Resources = { xp: 0, coins: 0, crystals: 0, materials: 0 };

function fromState(s: GameState, guest: boolean, role?: MemberRole): PlayerSummary {
  return {
    guest,
    name: s.player.name,
    avatar: s.player.avatar,
    level: s.player.level,
    resources: s.player.resources,
    questsWaiting: s.quests.filter((q) => q.status === "completed" || q.status === "available").length,
    started: s.player.level.xp > 0 || s.quests.some((q) => q.status !== "available" && q.status !== "locked"),
    role,
    family: guest ? undefined : { name: s.family.name, level: s.family.level.level, members: s.family.members },
  };
}

/**
 * The lobby's view of the current player, read from the same sources the game
 * uses: `/game/state` for members (cache shared with /play), the device-local
 * guest store for guests. Never loads Phaser.
 */
export function usePlayerSummary(signedIn: boolean) {
  const { t } = useTranslation();
  const me = useMe();
  const familyId = auth.getFamilyId();
  const membership = me.data?.memberships.find((m) => m.familyId === familyId) ?? me.data?.memberships[0];
  const guestStarted = !signedIn && hasGuestProgress();

  const member = useQuery({
    queryKey: gameKeys.state(membership?.memberId ?? "self"),
    queryFn: () => gameApi.state(membership!.memberId),
    enabled: signedIn && !!membership,
  });
  const guest = useQuery({
    queryKey: ["game", "guest"],
    queryFn: () => guestBackend(t("game.guest.name")).state(),
    enabled: guestStarted,
  });

  if (signedIn) {
    return {
      loading: me.isLoading || member.isLoading,
      error: member.isError,
      summary: member.data ? fromState(member.data, false, membership?.role) : null,
    };
  }
  const summary: PlayerSummary = guest.data
    ? fromState(guest.data, true)
    : {
        guest: true,
        name: t("game.guest.name"),
        avatar: GUEST_DEFAULT_AVATAR,
        level: EMPTY_LEVEL,
        resources: NO_RESOURCES,
        questsWaiting: 0,
        started: false,
      };
  return { loading: guestStarted && guest.isLoading, error: false, summary };
}
