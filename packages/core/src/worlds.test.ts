import { describe, expect, it } from "vitest";
import { WORLDS, canLaunchWorld, featuredWorld, listedWorlds, parseWorldCatalog, worldDefinitionSchema } from "./worlds";

const base = {
  id: "x-world",
  slug: "x-world",
  category: "puzzle",
  engine: "react",
  status: "available",
  version: "1.0.0",
  entryRoute: "/play",
  thumbnail: "island",
  guestAccessible: true,
  supportedDevices: ["desktop"],
};

describe("world registry", () => {
  it("ships a valid catalog with the adventure village as the featured, playable world", () => {
    expect(() => parseWorldCatalog(WORLDS)).not.toThrow();
    const f = featuredWorld();
    expect(f.id).toBe("family-adventure");
    expect(f.entryRoute).toBe("/play");
    expect(canLaunchWorld(f, { guest: true })).toBe(true);
  });

  it("lists the Learning Academy as a playable guest world at /academy", () => {
    const academy = WORLDS.find((w) => w.id === "learning-academy")!;
    expect(academy.entryRoute).toBe("/academy");
    expect(canLaunchWorld(academy, { guest: true })).toBe(true);
  });

  it("never lets unfinished worlds launch", () => {
    for (const w of WORLDS.filter((x) => x.status !== "available")) {
      expect(canLaunchWorld(w, { guest: false })).toBe(false);
    }
  });

  it("requires an entry route for available worlds", () => {
    expect(() => worldDefinitionSchema.parse({ ...base, entryRoute: null })).toThrow();
    expect(() => worldDefinitionSchema.parse({ ...base, status: "coming_soon", entryRoute: null })).not.toThrow();
  });

  it("rejects external or script-like entry routes and remote thumbnails", () => {
    for (const entryRoute of ["https://evil.test", "//evil.test", "javascript:alert(1)", "/play?x=<s>"]) {
      expect(() => worldDefinitionSchema.parse({ ...base, entryRoute })).toThrow();
    }
    expect(() => worldDefinitionSchema.parse({ ...base, thumbnail: "https://x.test/a.png" })).toThrow();
  });

  it("rejects duplicate ids or slugs", () => {
    expect(() => parseWorldCatalog([base, { ...base, slug: "other" }])).toThrow(/duplicate/);
    expect(() => parseWorldCatalog([base, { ...base, id: "other" }])).toThrow(/duplicate/);
  });

  it("hides drafts and disabled worlds and gates account-only worlds from guests", () => {
    const worlds = parseWorldCatalog([
      base,
      { ...base, id: "d", slug: "d", status: "draft" },
      { ...base, id: "off", slug: "off", status: "disabled" },
      { ...base, id: "acct", slug: "acct", guestAccessible: false },
    ]);
    expect(listedWorlds(worlds).map((w) => w.id)).toEqual(["x-world", "acct"]);
    const acct = worlds.find((w) => w.id === "acct")!;
    expect(canLaunchWorld(acct, { guest: true })).toBe(false);
    expect(canLaunchWorld(acct, { guest: false })).toBe(true);
  });
});
