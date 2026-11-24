/** Professor Owl at the lectern: blinks, bobs, and tilts while talking (CSS only). */
export function ProfessorOwl({ talking }: { talking: boolean }) {
  return (
    <svg className={`ac-owl ${talking ? "talking" : ""}`} viewBox="0 0 120 150" aria-hidden>
      <ellipse cx="60" cy="144" rx="44" ry="6" fill="rgba(10,0,40,0.35)" />
      {/* lectern */}
      <path d="M22 104 H98 L90 142 H30 Z" fill="#8a5a3c" />
      <path d="M16 98 H104 V108 H16 Z" fill="#a0703f" />
      <rect x="40" y="114" width="40" height="5" rx="2" fill="#6f4630" />
      <g className="ac-owl-body">
        <ellipse cx="60" cy="72" rx="34" ry="36" fill="#8a5a3c" />
        <ellipse cx="60" cy="82" rx="21" ry="23" fill="#e8c9a0" />
        <path d="M68 76 q6 4 0 8 M52 80 q6 4 0 8 M60 90 q6 4 0 8" stroke="#c9a77c" strokeWidth="2" fill="none" />
        <g className="ac-owl-head">
          <path d="M30 42 L38 18 L50 38 Z M90 42 L82 18 L70 38 Z" fill="#6f4630" />
          <ellipse cx="60" cy="48" rx="32" ry="24" fill="#8a5a3c" />
          <circle cx="46" cy="48" r="12" fill="#fff" />
          <circle cx="74" cy="48" r="12" fill="#fff" />
          <circle className="ac-owl-pupil" cx="47" cy="49" r="5.5" fill="#2a2140" />
          <circle className="ac-owl-pupil" cx="73" cy="49" r="5.5" fill="#2a2140" />
          <g className="ac-owl-lids">
            <rect x="33" y="35" width="26" height="26" rx="13" fill="#8a5a3c" />
            <rect x="61" y="35" width="26" height="26" rx="13" fill="#8a5a3c" />
          </g>
          <circle cx="46" cy="48" r="12" fill="none" stroke="#2a2140" strokeWidth="2.5" />
          <circle cx="74" cy="48" r="12" fill="none" stroke="#2a2140" strokeWidth="2.5" />
          <path d="M58 48 H62" stroke="#2a2140" strokeWidth="2.5" />
          <path className="ac-owl-beak" d="M55 58 L60 66 L65 58 Z" fill="#f6c445" />
          {/* mortarboard */}
          <path d="M30 26 L60 14 L90 26 L60 36 Z" fill="#2a2140" />
          <rect x="50" y="28" width="20" height="8" fill="#2a2140" />
          <path d="M86 26 V40" stroke="#f6c445" strokeWidth="2" />
          <circle cx="86" cy="42" r="3" fill="#f6c445" />
        </g>
      </g>
      {/* open book on the lectern */}
      <path d="M34 100 Q47 92 60 100 Q73 92 86 100 V104 H34 Z" fill="#fff7d6" stroke="#d9c08a" />
    </svg>
  );
}
