// Lightweight world thumbnails: original inline SVG, no game engine and no
// network requests. `animated` adds CSS-only motion (off for reduced motion).

import type { ReactNode } from "react";

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="16" rx="13" ry="4" fill="rgba(20,50,20,0.25)" />
      <rect x="-3" y="2" width="6" height="14" rx="2" fill="#7a4f2e" />
      <circle cx="0" cy="-4" r="13" fill="#3f9a46" />
      <circle cx="-4" cy="-8" r="8" fill="#4fb153" />
      <circle cx="3" cy="-11" r="5" fill="#6fca69" />
    </g>
  );
}

function Pine({ x, y, s = 1, c = "#2f7d43" }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="18" rx="11" ry="3.5" fill="rgba(10,30,10,0.3)" />
      <rect x="-2.5" y="8" width="5" height="10" fill="#6d4426" />
      <path d="M0 -22 L14 4 H-14 Z" fill={c} />
      <path d="M0 -10 L16 12 H-16 Z" fill={c} />
    </g>
  );
}

function House({ x, y, roof }: { x: number; y: number; roof: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="20" rx="26" ry="5" fill="rgba(20,50,20,0.22)" />
      <rect x="-20" y="-6" width="40" height="26" rx="3" fill="#fff3dc" />
      <path d="M-25 -4 L0 -24 L25 -4 Z" fill={roof} />
      <rect x="-5" y="6" width="10" height="14" rx="2" fill="#8a5a3c" />
      <rect x="-16" y="1" width="8" height="7" rx="1.5" fill="#8fd3f5" />
      <rect x="8" y="1" width="8" height="7" rx="1.5" fill="#8fd3f5" />
    </g>
  );
}

function Village({ animated }: { animated: boolean }) {
  return (
    <>
      <rect width="320" height="180" fill="#86c96f" />
      <path d="M0 98 H320" stroke="#ecd9a6" strokeWidth="18" />
      <path d="M150 0 V180" stroke="#ecd9a6" strokeWidth="18" />
      <circle cx="150" cy="98" r="34" fill="#ecd9a6" />
      <path d="M262 -5 C248 40 276 70 258 110 C244 140 270 160 262 190" stroke="#4fb0e3" strokeWidth="22" fill="none" />
      <g className={animated ? "wa-flow" : undefined} stroke="#d6f1ff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8">
        <path d="M256 30 q4 -3 8 0" />
        <path d="M262 70 q4 -3 8 0" />
        <path d="M256 140 q4 -3 8 0" />
      </g>
      <rect x="240" y="88" width="40" height="20" rx="3" fill="#a0602e" />
      <path d="M242 93 H278 M242 103 H278" stroke="#7a4420" strokeWidth="2" />
      <ellipse cx="150" cy="101" rx="20" ry="9" fill="#b9b3a6" />
      <ellipse cx="150" cy="99" rx="16" ry="6.5" fill="#4fb0e3" />
      <rect x="146" y="84" width="8" height="15" rx="3" fill="#cfc9bc" />
      <circle className={animated ? "wa-spark" : undefined} cx="150" cy="80" r="3.5" fill="#d6f1ff" />
      <House x={70} y={58} roof="#e9475a" />
      <House x={70} y={140} roof="#3b82f6" />
      <House x={210} y={150} roof="#8b5cf6" />
      <g transform="translate(186 118)">
        <rect x="-9" y="-6" width="18" height="12" rx="2" fill="#a0602e" />
        <path d="M-9 -6 Q-9 -14 0 -14 Q9 -14 9 -6 Z" fill="#c27a3c" />
        <rect x="-2" y="-7" width="4" height="6" fill="#f6c445" />
      </g>
      <g className={animated ? "wa-bob" : undefined} transform="translate(186 96)">
        <circle r="6" fill="#f6c445" />
        <text y="3.5" textAnchor="middle" fontSize="9" fontWeight="900" fill="#2a2140">!</text>
      </g>
      <Tree x={20} y={22} />
      <Tree x={118} y={30} s={0.9} />
      <Tree x={200} y={34} />
      <Tree x={22} y={150} s={0.9} />
      <Tree x={118} y={156} />
      <Pine x={300} y={40} />
      <Pine x={302} y={150} s={0.9} />
      <g transform="translate(150 132)">
        <ellipse cx="0" cy="9" rx="7" ry="2.5" fill="rgba(20,50,20,0.3)" />
        <rect x="-5" y="-4" width="10" height="12" rx="3" fill="#3b82f6" />
        <circle cx="0" cy="-8" r="6" fill="#eab68f" />
        <path d="M-6 -10 Q0 -17 6 -10 Z" fill="#1d4ed8" />
      </g>
      <g className={animated ? "wa-fly" : undefined} transform="translate(96 108)">
        <ellipse cx="-3" cy="0" rx="3" ry="4" fill="#ff9ad0" />
        <ellipse cx="3" cy="0" rx="3" ry="4" fill="#ff9ad0" />
      </g>
    </>
  );
}

function Academy({ animated }: { animated: boolean }) {
  return (
    <>
      <rect width="320" height="180" fill="#2b1f5c" />
      <circle cx="40" cy="30" r="1.5" fill="#fff" />
      <circle cx="280" cy="24" r="1.5" fill="#fff" />
      <circle cx="250" cy="60" r="1" fill="#fff" />
      <rect x="0" y="140" width="320" height="40" fill="#4b3a8c" />
      <rect x="110" y="60" width="100" height="82" rx="4" fill="#e9e3ff" />
      <path d="M100 64 L160 22 L220 64 Z" fill="#6b4fd8" />
      <circle cx="160" cy="48" r="9" fill="#f6c445" />
      <path d="M150 142 V108 Q160 96 170 108 V142 Z" fill="#8a5a3c" />
      <rect x="122" y="80" width="16" height="20" rx="8" fill="#8fd3f5" />
      <rect x="182" y="80" width="16" height="20" rx="8" fill="#8fd3f5" />
      {[[52, 70, "#8b5cf6"], [262, 82, "#22c55e"], [70, 120, "#f59e0b"], [250, 128, "#ec4899"]].map(([x, y, c], i) => (
        <g key={i} className={animated ? "wa-bob" : undefined} style={{ animationDelay: `${i * 0.4}s` }} transform={`translate(${x} ${y})`}>
          <rect x="-13" y="-17" width="26" height="34" rx="5" fill="#6b4fd8" stroke="#c4b5fd" strokeWidth="2" />
          <path d="M0 -9 L7 0 L0 9 L-7 0 Z" fill={c as string} />
        </g>
      ))}
    </>
  );
}

function Forest({ animated }: { animated: boolean }) {
  return (
    <>
      <rect width="320" height="180" fill="#2f6b3a" />
      <path d="M0 120 C80 100 120 140 180 118 C240 96 280 126 320 112 V180 H0 Z" fill="#3f8a46" />
      <path d="M140 180 C150 150 170 140 160 110" stroke="#c9b27a" strokeWidth="14" fill="none" />
      {[[30, 60], [70, 40], [110, 70], [220, 50], [260, 72], [300, 44], [40, 130], [280, 140], [200, 120]].map(([x, y], i) => (
        <Pine key={i} x={x!} y={y!} s={1.3} c={i % 2 ? "#1f5e33" : "#2a7a40"} />
      ))}
      <g transform="translate(160 96)">
        <rect x="-26" y="-30" width="8" height="34" fill="#7a4f2e" />
        <rect x="18" y="-30" width="8" height="34" fill="#7a4f2e" />
        <path d="M-30 -30 Q0 -50 30 -30" stroke="#7a4f2e" strokeWidth="7" fill="none" />
      </g>
      {[[90, 100], [200, 90], [240, 110], [120, 130], [60, 96]].map(([x, y], i) => (
        <circle key={i} className={animated ? "wa-glow" : undefined} style={{ animationDelay: `${i * 0.5}s` }} cx={x} cy={y} r="2.5" fill="#fff59d" />
      ))}
    </>
  );
}

function Home() {
  return (
    <>
      <rect width="320" height="180" fill="#fde8c8" />
      <rect y="122" width="320" height="58" fill="#c98a52" />
      <path d="M0 132 H320 M0 150 H320 M0 168 H320" stroke="#b5773f" strokeWidth="2" />
      <rect x="40" y="30" width="70" height="52" rx="6" fill="#8fd3f5" stroke="#fff" strokeWidth="6" />
      <path d="M75 30 V82 M40 56 H110" stroke="#fff" strokeWidth="4" />
      <rect x="150" y="40" width="34" height="26" rx="3" fill="#f6c445" stroke="#8a5a3c" strokeWidth="3" />
      <rect x="200" y="36" width="26" height="34" rx="3" fill="#a7f3d0" stroke="#8a5a3c" strokeWidth="3" />
      <rect x="140" y="96" width="120" height="34" rx="12" fill="#e9475a" />
      <rect x="130" y="88" width="20" height="44" rx="8" fill="#c0384a" />
      <rect x="250" y="88" width="20" height="44" rx="8" fill="#c0384a" />
      <rect x="40" y="96" width="44" height="40" rx="4" fill="#8a5a3c" />
      <circle cx="62" cy="86" r="12" fill="#4fb153" />
      <rect x="56" y="88" width="12" height="10" rx="2" fill="#e98c4c" />
    </>
  );
}

function Island({ animated }: { animated: boolean }) {
  return (
    <>
      <rect width="320" height="180" fill="#38bdf8" />
      <g className={animated ? "wa-flow" : undefined} stroke="#e0f7ff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8">
        <path d="M30 40 q8 -5 16 0" />
        <path d="M260 30 q8 -5 16 0" />
        <path d="M40 150 q8 -5 16 0" />
        <path d="M270 150 q8 -5 16 0" />
      </g>
      <ellipse cx="160" cy="110" rx="110" ry="46" fill="#fde68a" />
      <ellipse cx="160" cy="104" rx="90" ry="34" fill="#86c96f" />
      <path d="M200 100 C204 70 210 56 220 44" stroke="#8a5a3c" strokeWidth="6" fill="none" />
      <path d="M220 44 C200 36 186 44 180 52 M220 44 C240 34 254 40 258 50 M220 44 C214 26 222 18 232 16" stroke="#3f9a46" strokeWidth="8" fill="none" strokeLinecap="round" />
      <g transform="translate(128 98)">
        <path d="M-18 -18 H-4 a6 6 0 1 1 8 0 H18 V-4 a6 6 0 1 1 0 8 V18 H-18 Z" fill="#8b5cf6" stroke="#fff" strokeWidth="2.5" />
      </g>
    </>
  );
}

const ART: Record<string, (p: { animated: boolean }) => ReactNode> = {
  village: Village,
  academy: Academy,
  forest: Forest,
  home: Home,
  island: Island,
};

export function WorldArt({ thumbnail, animated = false, className }: { thumbnail: string; animated?: boolean; className?: string }) {
  const Art = ART[thumbnail] ?? Village;
  return (
    <svg className={`world-art ${className ?? ""}`} viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <Art animated={animated} />
    </svg>
  );
}
