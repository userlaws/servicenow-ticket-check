// Generates the sample people's profile pictures as static SVGs in
// public/avatars. Run it again only if the list of sample names changes:
//   node scripts/make-avatars.mjs
// Style: DiceBear "Notionists" by Zoish, CC0 1.0. Library: DiceBear, MIT.
import { createAvatar } from "@dicebear/core";
import { notionists } from "@dicebear/collection";
import { mkdirSync, writeFileSync } from "node:fs";

// Made-up sample people, each with a soft background from the site palette.
const PEOPLE = {
  jordan: "e7e2ff",
  alex: "d7f3e5",
  sam: "dbe8ff",
  priya: "ffe6cf",
  dana: "fde2ec",
  chris: "e3f1f6",
  rosa: "f3ecd2",
  nadia: "ece2ff",
  morgan: "e6f0dc",
  you: "fde2ec",
};

mkdirSync("public/avatars", { recursive: true });
for (const [name, bg] of Object.entries(PEOPLE)) {
  const svg = createAvatar(notionists, { seed: `ticket-check-${name}`, backgroundColor: [bg], radius: 50 }).toString();
  writeFileSync(`public/avatars/${name}.svg`, svg);
}
console.log(`Wrote ${Object.keys(PEOPLE).length} avatars to public/avatars`);
