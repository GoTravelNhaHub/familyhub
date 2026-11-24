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

/* Portraits and menu glyphs for the HUD and dialogue headers. */

export function OwlIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <ellipse cx="20" cy="24" rx="13" ry="14" fill="#8a5a3c" />
      <ellipse cx="20" cy="28" rx="8" ry="9" fill="#e8c9a0" />
      <path d="M8 12 L12 4 L16 11 Z M32 12 L28 4 L24 11 Z" fill="#6f4630" />
      <circle cx="14.5" cy="17" r="5.5" fill="#fff" />
      <circle cx="25.5" cy="17" r="5.5" fill="#fff" />
      <circle cx="15" cy="17.5" r="2.6" fill="#2a2140" />
      <circle cx="25" cy="17.5" r="2.6" fill="#2a2140" />
      <circle cx="14.5" cy="17" r="5.5" fill="none" stroke="#2a2140" strokeWidth="1.2" />
      <circle cx="25.5" cy="17" r="5.5" fill="none" stroke="#2a2140" strokeWidth="1.2" />
      <path d="M18 22 L20 25 L22 22 Z" fill="#f6c445" />
    </svg>
  );
}

export function ScrollIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <rect x="4" y="3" width="12" height="14" rx="2" fill="#fff3d0" stroke="#b8893a" strokeWidth="1.4" />
      <path d="M7 7 H13 M7 10 H13 M7 13 H11" stroke="#b8893a" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ChestIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect x="6" y="18" width="28" height="16" rx="3" fill="#a0602e" />
      <path d="M6 18 Q6 8 20 8 Q34 8 34 18 Z" fill="#c27a3c" />
      <rect x="6" y="17" width="28" height="4" fill="#f6c445" />
      <rect x="17" y="17" width="6" height="9" rx="1.5" fill="#f6c445" stroke="#b8893a" />
    </svg>
  );
}

export function GateIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path d="M20 4 L33 9 V20 C33 28 27 33 20 36 C13 33 7 28 7 20 V9 Z" fill="#3f9a46" stroke="#2c6e33" strokeWidth="2" />
      <path d="M14 20 L18 24 L26 15" stroke="#fff7d6" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShirtIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <path d="M7 3 L3 6 L5 9 L6 8.5 V17 H14 V8.5 L15 9 L17 6 L13 3 C12 5 8 5 7 3 Z" fill="#8fb7ff" stroke="#3b5fb8" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function SwapIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <path d="M4 7 H15 L12 4 M16 13 H5 L8 16" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MapIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <path d="M2.5 5 L7 3 L13 5 L17.5 3 V15 L13 17 L7 15 L2.5 17 Z" fill="#d9f0c9" stroke="#3f7a3a" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 3 V15 M13 5 V17" stroke="#3f7a3a" strokeWidth="1.1" />
    </svg>
  );
}

export function PinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <path d="M10 18 C10 18 4 11.5 4 8 A6 6 0 0 1 16 8 C16 11.5 10 18 10 18 Z" fill="#f6c445" stroke="#b8893a" strokeWidth="1.3" />
      <circle cx="10" cy="8" r="2.2" fill="#fff" />
    </svg>
  );
}
