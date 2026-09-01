/**
 * Everything group-specific lives here, read from the environment so the same
 * build serves any community. Nothing about a particular course, cohort, or
 * schedule is hardcoded anywhere else in the app.
 */
export const branding = {
  /** Shown as the page heading, e.g. "Tuesday Builders". */
  groupName: process.env.GROUP_NAME || "Accountability Group",

  /** The thing members are working through, e.g. "Intro to Web Development". */
  courseName: process.env.COURSE_NAME || "",

  /** Free text, e.g. "Tuesdays 7pm with Ana, Thursdays 2pm with Ben". */
  sessions: process.env.SESSION_SCHEDULE || "",

  /**
   * How a member finds their own number. The whole design rests on members
   * reading a figure their course platform already computed rather than
   * estimating, so this sentence should name exactly where to look.
   */
  progressHint:
    process.env.PROGRESS_HINT ||
    "Open your course page and read the number of lessons you have completed.",
} as const;

/** "Course · 100 lessons · schedule", skipping whatever is unset. */
export function subtitle(totalLessons: number): string {
  return [
    branding.courseName,
    totalLessons ? `${totalLessons} lessons` : "",
    branding.sessions,
  ].filter(Boolean).join(" · ");
}
