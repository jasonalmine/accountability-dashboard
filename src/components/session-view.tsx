import { Card } from "./ui";
import type { Checkin } from "@/lib/types";

/** Latest submission per member, laid out to be read aloud during the session. */
export function SessionView({ checkins }: { checkins: Checkin[] }) {
  const latest = new Map<string, Checkin>();
  for (const c of checkins) if (!latest.has(c.name)) latest.set(c.name, c);
  const rows = [...latest.values()].filter((c) => c.blocker || c.commitment);

  return (
    <Card
      title="This week's blockers and commitments"
      note="Straight from the form. Block 3 works these; block 4 reads the commitments back."
    >
      {!rows.length && <p className="text-sm text-muted">No check-ins submitted yet.</p>}
      <ul className="space-y-4">
        {rows.map((c) => (
          <li key={c.name} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{c.name}</span>
              <span className="tnum text-xs text-muted">
                {c.lessonsDone ?? "—"}/114 · {c.currentModule || "—"}
              </span>
            </div>
            {c.blocker && (
              <p className="mt-1 text-sm">
                <span className="text-warn">Blocked: </span>{c.blocker}
              </p>
            )}
            {c.commitment && (
              <p className="mt-1 text-sm">
                <span className="text-ok">Committed: </span>{c.commitment}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
