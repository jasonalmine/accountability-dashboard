/**
 * Fire-and-forget handoff to an automation platform (n8n, Zapier, Make, or
 * your own endpoint), which owns reminders and any CRM sync.
 *
 * Postgres is the source of truth, so a failure here is never fatal: the row is
 * already committed with synced_at NULL, ready for a retry sweep. A member's submission must not be lost because the middle tier hiccuped.
 */
export async function notifyN8n(event: "intake" | "checkin", payload: unknown): Promise<boolean> {
  const base = process.env.N8N_WEBHOOK_URL;
  if (!base) return false;
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_WEBHOOK_SECRET ? { "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({ event, payload }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error(`n8n ${event} responded ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error(`n8n ${event} handoff failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}
