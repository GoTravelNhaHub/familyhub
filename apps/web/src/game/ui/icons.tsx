import type { Resources } from "../types";

const S = 18;

export function CoinIcon({ size = S }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10.6" r="8.4" fill="#c98a16" />
      <circle cx="10" cy="9.6" r="8.4" fill="#f6c445" />
      <circle cx="10" cy="9.6" r="5.6" fill="none" stroke="#e0a526" strokeWidth="1.6" />
      <path d="M7 6.5 Q9 5 11 6" stroke="#fff3b0" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function CrystalIcon({ size = S }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <path d="M10 1.5 L17 8 L10 18.5 L3 8 Z" fill="#8b5cf6" />
      <path d="M10 1.5 L13.5 8 L10 18.5 L6.5 8 Z" fill="#a98bff" />
      <path d="M3 8 H17" stroke="#6d3fe0" strokeWidth="1" />
      <path d="M8 4 L9.5 3" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function MaterialIcon({ size = S }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <rect x="2" y="10" width="9" height="7" rx="1.5" fill="#c0612b" />
      <rect x="9" y="10" width="9" height="7" rx="1.5" fill="#d9773a" />
      <rect x="5.5" y="3.5" width="9" height="7" rx="1.5" fill="#e98c4c" />
      <path d="M7 5.5 H11" stroke="#ffd2a8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function XpIcon({ size = S }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <path d="M10 1.8 L12.4 7 L18 7.6 L13.8 11.4 L15 17 L10 14.1 L5 17 L6.2 11.4 L2 7.6 L7.6 7 Z" fill="#22c55e" />
      <path d="M10 4.5 L11.3 7.9" stroke="#bbf7d0" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const ICONS = { xp: XpIcon, coins: CoinIcon, crystals: CrystalIcon, materials: MaterialIcon } as const;

/** Inline list of non-zero rewards, e.g. "+20 XP +10 coins". */
export function RewardChips({ reward, label }: { reward: Resources; label: (k: keyof Resources) => string }) {
  return (
    <span className="g-chips">
      {(Object.keys(ICONS) as (keyof Resources)[])
        .filter((k) => reward[k] > 0)
        .map((k) => {
          const Icon = ICONS[k];
          return (
            <span key={k} className="g-chip" title={label(k)}>
              <Icon size={15} /> +{reward[k]}
              <span className="sr-only"> {label(k)}</span>
            </span>
          );
        })}
    </span>
  );
}

export { ICONS as RESOURCE_ICONS };
