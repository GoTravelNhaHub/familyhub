import { safeNextPath } from "@family-hub/core";

/** `?next=` target after login or sign-up (same-origin app paths only). */
export const safeNext = safeNextPath;

/** Appends `next` to an auth route when it is worth carrying along. */
export function withNext(path: string, next: string | null | undefined): string {
  const target = safeNextPath(next, "");
  return target && target !== "/" ? `${path}?next=${encodeURIComponent(target)}` : path;
}
