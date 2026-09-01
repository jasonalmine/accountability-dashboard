/** Stage names come from the `stages` table, so this is open text. */
export type Stage = string;
export type Status = "OK" | "STALLED" | "NO MOVEMENT" | "No check-in";

export interface Member {
  name: string;
  email: string;
  batch: string;
  stage: Stage | string;
  priority: boolean;
  active: boolean;
  intakeDone: boolean;
}

export interface Progress {
  name: string;
  batch: string;
  priority: boolean;
  stage: string;
  lessonsDone: number | null;
  denominator: number;
  percent: number | null;
  currentModule: string;
  lastCheckin: string | null;
  delta: number | null;
  daysSince: number | null;
  status: Status;
}

export interface Checkin {
  timestamp: string;
  name: string;
  lessonsDone: number | null;
  currentModule: string;
  completed: string;
  blocker: string;
  commitment: string;
}

export interface ModuleRow {
  key: string;
  label: string;
  lessons: number | null;
  visible: boolean;
}

export interface Kpis {
  roster: number;
  active: number;
  priority: number;
  intakeDone: number;
  intakeOutstanding: number;
  checkedInRecently: number;
  compliance: number;
  avgCompletion: number;
  needsAttention: number;
  neverCheckedIn: number;
}

export interface DashboardData {
  members: Member[];
  progress: Progress[];
  checkins: Checkin[];
  modules: ModuleRow[];
  kpis: Kpis;
  totalLessons: number;
  generatedAt: string;
}
