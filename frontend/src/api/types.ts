export type QuestionCategory = "behavioral" | "technical" | "role_specific";

export type SessionTier = "Exploring" | "Emerging" | "Ready";

export type RoleLevel = "internship" | "entry" | "mid" | "senior" | "staff";

export interface Role {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
}

export interface Question {
  id: number;
  role_id: number;
  text: string;
  category: QuestionCategory;
  level: RoleLevel;
  difficulty: number;
  expected_duration_sec?: number | null;
  requires_code: boolean;
  keywords: string[];
}

export interface Evaluation {
  id: number;
  score: number;
  rubric: Record<string, number>;
  feedback_markdown: string;
  suggested_improvements: string[];
  readiness_tier: SessionTier;
}

export interface EvaluationMeta {
  fallback?: string;
  reason?: string;
  message?: string;
  mode?: string;
  debug?: Record<string, unknown>;
}

export interface EvaluationResponse {
  evaluation: Evaluation;
  meta?: EvaluationMeta | null;
}

export interface DiagnosticsStatus {
  path?: string | null;
  reason?: string | null;
  mode?: string | null;
  model?: string | null;
  provider?: string | null;
  base_url?: string | null;
}

export interface DiagnosticsResponse {
  env: Record<string, unknown>;
  config: Record<string, unknown>;
  reason: string;
  models: {
    provider?: string | null;
    base_url?: string | null;
    eval_model?: string | null;
  };
  status: DiagnosticsStatus;
}

export interface Answer {
  id: number;
  question: Question;
  answer_text: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  transcript_text?: string | null;
  evaluation?: Evaluation | null;
}

export interface Session {
  id: number;
  role: Role;
  level: RoleLevel;
  started_at: string;
  ended_at?: string | null;
  overall_score?: number | null;
  summary_tier?: SessionTier | null;
}

export interface SessionDetail extends Session {
  answers: Answer[];
}

export interface HistoryItem extends Session {}
