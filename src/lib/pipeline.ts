/**
 * Mirrors a member's progress into a CRM pipeline stage.
 *
 * The point is not reporting: a stage change is a first-class workflow trigger,
 * so "entered Certification Ready" can start a sequence without anything here
 * knowing that sequence exists. Progress stays the source of truth; the stage
 * is a projection of it.
 *
 * Configure with PIPELINE_ID and PIPELINE_STAGES (JSON: stage name -> id).
 * Unset means mirroring is skipped entirely and nothing else changes.
 */
export type StageBand = { name: string; upTo: number | null };

/** Bands are cumulative lesson counts, in order. `upTo: null` is the last one. */
function bands(): StageBand[] {
  const raw = process.env.PIPELINE_BANDS;
  if (raw) {
    try {
      return JSON.parse(raw) as StageBand[];
    } catch (err) {
      console.error("PIPELINE_BANDS is not valid JSON, mirroring disabled:", err);
      return [];
    }
  }
  return [];
}

function stageIds(): Record<string, string> {
  const raw = process.env.PIPELINE_STAGES;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch (err) {
    console.error("PIPELINE_STAGES is not valid JSON, mirroring disabled:", err);
    return {};
  }
}

export function isMirroring(): boolean {
  return Boolean(process.env.PIPELINE_ID) && Object.keys(stageIds()).length > 0 && bands().length > 0;
}

/** The stage a lesson count belongs in. null when nothing is configured. */
export function stageForCount(lessons: number | null): { name: string; id: string } | null {
  if (!isMirroring()) return null;
  const ids = stageIds();
  const list = bands();
  // No check-in yet: the first band is the entry stage.
  if (lessons === null) {
    const first = list[0];
    return first && ids[first.name] ? { name: first.name, id: ids[first.name] } : null;
  }
  for (const b of list.slice(1)) {
    if (b.upTo === null || lessons <= b.upTo) {
      return ids[b.name] ? { name: b.name, id: ids[b.name] } : null;
    }
  }
  const last = list[list.length - 1];
  return last && ids[last.name] ? { name: last.name, id: ids[last.name] } : null;
}

export const pipelineId = () => process.env.PIPELINE_ID ?? "";
