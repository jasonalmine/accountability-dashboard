"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not sign in.");
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-border bg-surface p-6">
        <h1 className="text-lg">Facilitator sign-in</h1>
        <p className="mt-1 text-sm text-muted">Enter the group password to see cohort progress.</p>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoFocus autoComplete="current-password" placeholder="Group password"
          className="mt-4 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {error && <p className="mt-2 text-sm text-alert">{error}</p>}
        <button
          type="submit" disabled={busy || !password}
          className="mt-4 w-full rounded bg-accent px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
