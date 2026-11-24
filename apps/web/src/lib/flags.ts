// Release flags for the game-first platform rollout. Build-time defaults come
// from VITE_FLAG_* (set "0" to turn a flag off and restore the previous
// experience); a per-browser override in localStorage `fh.flags`
// (e.g. {"gameFirstHome":false}) helps QA compare both paths.

export interface Flags {
  /** `/` is the game lobby; the parent dashboard moves to `/family`. */
  gameFirstHome: boolean;
  /** Platform navigation (Home / Play / Family) in the shell. */
  platformNavigation: boolean;
}

const env = import.meta.env as Record<string, string | undefined>;
const fromEnv = (name: string, fallback: boolean) => {
  const v = env[`VITE_FLAG_${name}`];
  return v === undefined || v === "" ? fallback : v !== "0" && v !== "false";
};

function readOverrides(): Partial<Flags> {
  try {
    const raw = localStorage.getItem("fh.flags");
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Partial<Flags> = {};
    for (const k of ["gameFirstHome", "platformNavigation"] as const) {
      const v = (parsed as Record<string, unknown>)[k];
      if (typeof v === "boolean") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export const flags: Flags = {
  gameFirstHome: fromEnv("GAME_FIRST_HOME", true),
  platformNavigation: fromEnv("PLATFORM_NAVIGATION", true),
  ...readOverrides(),
};
