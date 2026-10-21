"use client";

import { useState, type CSSProperties } from "react";
import { base } from "@/lib/base";

// Profile pictures for the sample people. The art is DiceBear "Notionists"
// (CC0), generated into public/avatars by scripts/make-avatars.mjs, so nothing
// loads from another site. Anyone without a picture gets their initial.
const PICTURES = new Set(["jordan", "alex", "sam", "priya", "dana", "chris", "rosa", "nadia", "morgan", "you"]);

export function Avatar({ name, className = "", style }: { name: string; className?: string; style?: CSSProperties }) {
  const key = name.split(/[\s.]/)[0].toLowerCase();
  const [failed, setFailed] = useState(false);
  const pic = PICTURES.has(key) && !failed;
  return (
    <span className={`av ${className}`} style={style} aria-hidden="true">
      {pic ? <img src={`${base}/avatars/${key}.svg`} alt="" draggable={false} onError={() => setFailed(true)} /> : <span className="av-fallback">{name[0]}</span>}
    </span>
  );
}

type Person = { name: string; role: string };

// Overlapping profile pictures. Hovering one lifts it and shows who it is;
// the +N chip lists the people who don't fit. Built after Cnippet's Avatar
// Stack on 21st.dev, written from scratch for this site.
export function AvatarStack({ people, max = 3, interactive = false, className = "" }: { people: Person[]; max?: number; interactive?: boolean; className?: string }) {
  const shown = people.slice(0, max);
  const rest = people.slice(max);
  const focus = interactive ? 0 : undefined;
  return (
    <span className={`stack ${className}`} aria-hidden={interactive ? undefined : true} role={interactive ? "list" : undefined}>
      {shown.map((p) => (
        <span key={p.name} className="stack-item" tabIndex={focus} role={interactive ? "listitem" : undefined} aria-label={interactive ? `${p.name}, ${p.role}` : undefined}>
          <Avatar name={p.name} />
          <span className="stack-tip" role="tooltip">
            <b>{p.name}</b>
            <span>{p.role}</span>
          </span>
        </span>
      ))}
      {rest.length > 0 && (
        <span className="stack-item stack-more" tabIndex={focus} role={interactive ? "listitem" : undefined} aria-label={interactive ? `${rest.length} more: ${rest.map((p) => p.name).join(", ")}` : undefined}>
          <span className="av av-more">+{rest.length}</span>
          <span className="stack-tip" role="tooltip">
            <b>{rest.length} more waiting</b>
            {rest.map((p) => (
              <span key={p.name}>
                {p.name}, {p.role}
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
