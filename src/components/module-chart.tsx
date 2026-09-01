"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "./ui";
import type { ModuleRow, Progress } from "@/lib/types";

/**
 * The highest-value view for a facilitator: where members are bunched decides
 * what gets taught on Thursday. Modules 2 and 4 alone are 38% of the course,
 * so a pile-up there is expected rather than alarming.
 */
export function ModuleChart({ modules, progress }: { modules: ModuleRow[]; progress: Progress[] }) {
  const data = modules
    .filter((m) => m.visible)
    .map((m) => ({
      key: m.key,
      label: m.label,
      lessons: m.lessons ?? 0,
      members: progress.filter((p) => p.currentModule === m.key).length,
    }));

  const busiest = Math.max(...data.map((d) => d.members), 0);

  return (
    <Card title="Where the cohort is bunched" note="Members reporting this as their current module.">
      <div className="h-[26rem] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" allowDecimals={false} stroke="var(--muted)" fontSize={11} />
            <YAxis
              type="category" dataKey="key" width={92}
              stroke="var(--muted)" fontSize={11} tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--track)" }}
              contentStyle={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 8, fontSize: 12, color: "var(--foreground)",
              }}
              formatter={(v) => {
                const n = Number(v);
                return [`${n} member${n === 1 ? "" : "s"}`, "Here now"];
              }}
              labelFormatter={(k) => data.find((d) => d.key === String(k))?.label ?? String(k)}
            />
            {/* Animation off: after hydration Recharts leaves the entry
                animation frozen at ~2.6%, rendering 2px slivers instead of bars. */}
            <Bar dataKey="members" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell
                  key={d.key}
                  fill={d.members === busiest && busiest > 0 ? "var(--warn)" : "var(--accent)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
