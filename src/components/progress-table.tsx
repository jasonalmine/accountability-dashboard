"use client";

import { useMemo, useState } from "react";
import { Bar, Card, StatusBadge } from "./ui";
import type { Progress } from "@/lib/types";

type SortKey = "percent" | "name" | "days" | "delta";

export function ProgressTable({ rows }: { rows: Progress[] }) {
  const [sort, setSort] = useState<SortKey>("percent");
  const [priorityOnly, setPriorityOnly] = useState(false);

  const sorted = useMemo(() => {
    const list = priorityOnly ? rows.filter((r) => r.priority) : rows;
    // Members with no check-in have no position to rank, so they always sink to
    // the bottom. Ranking them as "furthest behind" buries everyone actionable
    // under a wall of empty rows and breaks this table's whole promise.
    const noData = (r: Progress) => r.lessonsDone === null;
    const num = (v: number | null, fallback: number) => (v === null ? fallback : v);
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (noData(a) !== noData(b)) return noData(a) ? 1 : -1;
      if (sort === "days") return num(b.daysSince, -1) - num(a.daysSince, -1);
      if (sort === "delta") return num(a.delta, Infinity) - num(b.delta, Infinity);
      return num(a.percent, Infinity) - num(b.percent, Infinity); // furthest behind first
    });
  }, [rows, sort, priorityOnly]);

  return (
    <Card
      title="Every member"
      note="Furthest-behind first. Members who have never checked in sink to the bottom."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        {(["percent", "name", "days", "delta"] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`rounded border px-2 py-1 ${
              sort === k ? "border-accent text-accent" : "border-border text-muted"
            }`}
          >
            {{ percent: "By progress", name: "By name", days: "By staleness", delta: "By movement" }[k]}
          </button>
        ))}
        <button
          onClick={() => setPriorityOnly((v) => !v)}
          className={`ml-auto rounded border px-2 py-1 ${
            priorityOnly ? "border-accent text-accent" : "border-border text-muted"
          }`}
        >
          {priorityOnly ? "Showing priority only" : "Priority only"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-medium">Member</th>
              <th className="py-2 pr-3 font-medium">Batch</th>
              <th className="py-2 pr-3 font-medium">Module</th>
              <th className="py-2 pr-3 font-medium">Lessons</th>
              <th className="py-2 pr-3 font-medium">Progress</th>
              <th className="py-2 pr-3 text-right font-medium">Change</th>
              <th className="py-2 pr-3 text-right font-medium">Days</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.name} className="border-b border-border/60">
                <td className="py-2 pr-3">
                  {r.name}
                  {r.priority && <span className="ml-2 text-xs text-accent">priority</span>}
                </td>
                <td className="py-2 pr-3 text-muted">{r.batch || "—"}</td>
                <td className="py-2 pr-3 text-muted">{r.currentModule || "—"}</td>
                <td className="tnum py-2 pr-3">
                  {r.lessonsDone === null ? "—" : `${r.lessonsDone}/${r.denominator}`}
                </td>
                <td className="py-2 pr-3 w-48"><Bar percent={r.percent} /></td>
                <td className="tnum py-2 pr-3 text-right">
                  {r.delta === null ? "—" : r.delta > 0 ? `+${r.delta}` : r.delta}
                </td>
                <td className="tnum py-2 pr-3 text-right text-muted">
                  {r.daysSince === null ? "—" : r.daysSince}
                </td>
                <td className="py-2"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
            {!sorted.length && (
              <tr><td colSpan={8} className="py-6 text-center text-muted">No members to show.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
