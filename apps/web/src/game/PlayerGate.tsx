import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { auth } from "../lib/api";
import { useMe } from "../hooks/useAuth";
import { gameApi, gameKeys } from "./gameApi";
import { AvatarPortrait } from "./ui/AvatarEditor";
import "./game.css";

const PLAYER_KEY = "fh.game.playerId";

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // per-viewer convenience only
  }
}

/**
 * Resolves who is playing for a signed-in session: kids play as themselves,
 * grown-ups pick who is holding the device (remembered per browser). Shared by
 * every world so they all use the same player and progression.
 */
export function PlayerGate({
  children,
}: {
  children: (p: { memberId: string; canSwitch: boolean; onSwitch: () => void }) => ReactNode;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const familyId = auth.getFamilyId();
  const membership = me.data?.memberships.find((m) => m.familyId === familyId) ?? me.data?.memberships[0];
  const [playerId, setPlayerId] = useState<string | null>(() => readLocal(PLAYER_KEY));
  const state = useQuery({
    queryKey: gameKeys.state(membership?.memberId ?? "self"),
    queryFn: () => gameApi.state(membership!.memberId),
    enabled: !!membership,
  });

  if (me.isLoading || !membership || state.isLoading) {
    return <div className="play-root play-loading"><div className="g-loader" />{t("game.ui.loading")}</div>;
  }
  if (state.isError || !state.data) {
    return <div className="play-root play-loading">{t("game.ui.loadError")}</div>;
  }

  const family = state.data.family.members;
  const isParent = membership.role === "parent";
  // Kids play as themselves; grown-ups pick who is holding the device.
  const chosen =
    !isParent || family.length <= 1 ? membership.memberId : family.find((m) => m.memberId === playerId)?.memberId;

  if (!chosen) {
    return (
      <div className="play-root play-picker">
        <h1>{t("game.picker.title")}</h1>
        <p className="muted">{t("game.picker.subtitle")}</p>
        <div className="g-picker-grid">
          {family.map((m) => (
            <button
              key={m.memberId}
              type="button"
              className="g-picker-card"
              onClick={() => {
                writeLocal(PLAYER_KEY, m.memberId);
                setPlayerId(m.memberId);
              }}
            >
              <AvatarPortrait avatar={m.avatar} size={72} />
              <strong>{m.name}</strong>
              <span className="muted small">{t("game.ui.level", { level: m.level })}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {children({
        memberId: chosen,
        canSwitch: isParent && family.length > 1,
        onSwitch: () => {
          writeLocal(PLAYER_KEY, null);
          setPlayerId(null);
        },
      })}
    </>
  );
}
