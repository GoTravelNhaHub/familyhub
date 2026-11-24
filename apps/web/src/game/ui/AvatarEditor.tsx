import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AVATAR_OPTIONS, paintAvatarPreview, type AvatarConfig } from "../avatar";

export function AvatarPortrait({ avatar, size = 48 }: { avatar: AvatarConfig; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ref.current.width = size * dpr;
    ref.current.height = size * 1.25 * dpr;
    paintAvatarPreview(ref.current, avatar);
  }, [avatar, size]);
  return <canvas ref={ref} className="g-portrait" style={{ width: size, height: size * 1.25 }} aria-hidden />;
}

interface Props {
  initial: AvatarConfig;
  saving: boolean;
  onSave: (a: AvatarConfig) => void;
  onCancel: () => void;
}

export function AvatarEditor({ initial, saving, onSave, onCancel }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AvatarConfig>(initial);
  const set = <K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const swatches = <K extends "skin" | "hairColor" | "outfit">(k: K) => (
    <div className="g-swatches" role="radiogroup" aria-label={t(`game.avatar.${k}`)}>
      {AVATAR_OPTIONS[k].map((c, i) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={draft[k] === c}
          aria-label={`${t(`game.avatar.${k}`)} ${i + 1}`}
          className={`g-swatch ${draft[k] === c ? "on" : ""}`}
          style={{ background: c }}
          onClick={() => set(k, c as AvatarConfig[K])}
        />
      ))}
    </div>
  );
  const choices = <K extends "hair" | "accessory">(k: K) => (
    <div className="g-choices" role="radiogroup" aria-label={t(`game.avatar.${k}`)}>
      {AVATAR_OPTIONS[k].map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={draft[k] === v}
          className={`g-choice ${draft[k] === v ? "on" : ""}`}
          onClick={() => set(k, v as AvatarConfig[K])}
        >
          {t(`game.avatar.${k}Options.${v}`)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="g-avatar-editor">
      <div className="g-avatar-preview">
        <AvatarPortrait avatar={draft} size={110} />
      </div>
      <div className="g-avatar-fields">
        <label>{t("game.avatar.skin")}</label>
        {swatches("skin")}
        <label>{t("game.avatar.hair")}</label>
        {choices("hair")}
        <label>{t("game.avatar.hairColor")}</label>
        {swatches("hairColor")}
        <label>{t("game.avatar.outfit")}</label>
        {swatches("outfit")}
        <label>{t("game.avatar.accessory")}</label>
        {choices("accessory")}
      </div>
      <div className="g-actions">
        <button type="button" className="ghost" onClick={onCancel}>{t("common.cancel")}</button>
        <button type="button" className="happy" disabled={saving} onClick={() => onSave(draft)}>
          {saving ? t("common.loading") : t("game.avatar.save")}
        </button>
      </div>
    </div>
  );
}
