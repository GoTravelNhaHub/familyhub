/**
 * Post-auth `?next=` target. Only same-origin app paths are allowed (no
 * `//host`, schemes, or backslashes), so the parameter cannot become an open
 * redirect.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !/^\/(?![/\\])[A-Za-z0-9/_\-?=&.#]*$/.test(raw)) return fallback;
  return raw;
}
