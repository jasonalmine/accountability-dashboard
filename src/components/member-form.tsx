"use client";

import { useState } from "react";

type Field = { name: string; label: string; hint?: string };

export function IntakeForm({ batches }: { batches: string[] }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [batch, setBatch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, batch }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save that.");
      setLink(new URL(json.checkinPath, window.location.origin).toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  if (link) {
    return (
      <div className="rounded-lg border border-ok/40 bg-surface p-5">
        <h2 className="text-base font-medium text-ok">You&apos;re in, {firstName}.</h2>
        <p className="mt-2 text-sm text-muted">
          This is your personal check-in link. Bookmark it. We&apos;ll also email it to you before
          each session, so you never have to hunt for it.
        </p>
        <p className="mt-3 break-all rounded border border-border bg-background p-3 font-mono text-xs">{link}</p>
        <a href={link} className="tap mt-4 inline-flex items-center rounded bg-accent px-5 text-sm text-white">
          Do your first check-in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">First name</span>
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name" placeholder="Ana" className="field" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Last name</span>
          <input required value={lastName} onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name" placeholder="Silva" className="field" />
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Your email</span>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" className="field" />
        <span className="text-xs text-muted">Used only for the check-in reminder before each session.</span>
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Your batch</span>
        <select required value={batch} onChange={(e) => setBatch(e.target.value)} className="field">
          <option value="">Choose your batch</option>
          {batches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>

      {error && <p className="text-sm text-alert">{error}</p>}
      <button type="submit" disabled={busy || !firstName.trim() || !lastName.trim() || !batch}
        className="tap justify-self-start rounded bg-accent px-5 text-sm text-white disabled:opacity-50">
        {busy ? "Saving…" : "Register"}
      </button>
    </form>
  );
}

export function CheckinForm({
  token, memberName, stage, modules, totalLessons, progressHint,
}: {
  token: string; memberName: string; stage: string;
  modules: { key: string; label: string }[]; totalLessons: number;
  progressHint: string;
}) {
  const [lessonsDone, setLessonsDone] = useState("");
  const [currentModule, setCurrentModule] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const text: Field[] = [
    { name: "completed", label: "What did you finish since the last session?" },
    { name: "blocker", label: "What's blocking you?", hint: "Be specific. This is what we work on in the session." },
    { name: "commitment", label: "What will you finish before the next session?" },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, lessonsDone: Number(lessonsDone), currentModule, stage, ...fields }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save that.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const pct = Math.round((Number(lessonsDone) / totalLessons) * 100);
    return (
      <div className="rounded-lg border border-ok/40 bg-surface p-5">
        <h2 className="text-base font-medium text-ok">Logged. Thanks, {memberName.split(" ")[0]}.</h2>
        <p className="mt-2 text-sm text-muted">
          You&apos;re at {lessonsDone} of {totalLessons} lessons ({pct}%), working in {currentModule}.
          See you at the session.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Lessons completed</span>
        <input required inputMode="numeric" pattern="[0-9]*" value={lessonsDone}
          onChange={(e) => setLessonsDone(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="42" className="field max-w-32" />
        <span className="text-xs text-muted">
          {progressHint} Copy that number exactly &mdash; don&apos;t estimate.
        </span>
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Which module are you in now?</span>
        <select required value={currentModule} onChange={(e) => setCurrentModule(e.target.value)} className="field">
          <option value="">Choose a module</option>
          {modules.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </label>

      {text.map((f) => (
        <label key={f.name} className="grid gap-1.5">
          <span className="text-sm font-medium">
            {f.label}{f.name === "commitment" && <span className="text-alert"> *</span>}
          </span>
          <textarea rows={2} required={f.name === "commitment"}
            value={fields[f.name] ?? ""}
            onChange={(e) => setFields((p) => ({ ...p, [f.name]: e.target.value }))}
            className="field resize-y" />
          {f.hint && <span className="text-xs text-muted">{f.hint}</span>}
        </label>
      ))}

      {error && <p className="text-sm text-alert">{error}</p>}
      <button type="submit" disabled={busy || !lessonsDone || !currentModule}
        className="tap justify-self-start rounded bg-accent px-5 text-sm text-white disabled:opacity-50">
        {busy ? "Saving…" : "Submit check-in"}
      </button>
    </form>
  );
}
