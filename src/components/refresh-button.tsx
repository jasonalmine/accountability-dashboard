"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => router.refresh())}
      className="rounded border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
    >
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
