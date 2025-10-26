import { apiClient } from "./client";
import type {
  Answer,
  DiagnosticsResponse,
  EvaluationResponse,
  HistoryItem,
  Question,
  Role,
  Session,
  SessionDetail,
  RoleLevel,
} from "./types";

export const fetchRoles = async (): Promise<Role[]> => {
  const response = await apiClient.get<Role[]>("/roles");
  return response.data;
};

export const fetchQuestions = async (params: {
  role: string;
  category?: string;
  level?: RoleLevel;
  limit?: number;
}): Promise<Question[]> => {
  const response = await apiClient.get<Question[]>("/questions", { params });
  return response.data;
};

export const createSession = async (payload: { role_slug: string; level: RoleLevel }): Promise<Session> => {
  const response = await apiClient.post<Session>("/sessions", payload);
  return response.data;
};

export const submitAnswer = async (
  sessionId: number,
  payload: {
    question_id: number;
    answer_text: string;
    started_at: string;
    ended_at: string;
    transcript_text?: string | null;
  },
): Promise<Answer> => {
  const response = await apiClient.post<Answer>(`/sessions/${sessionId}/answers`, payload);
  return response.data;
};

export const evaluateAnswer = async (
  answerId: number,
  options?: { debugForceLLM?: boolean },
): Promise<EvaluationResponse> => {
  const payload: Record<string, unknown> = { answer_id: answerId };
  if (options?.debugForceLLM !== undefined) {
    payload.debug_force_llm = options.debugForceLLM;
  }
  const response = await apiClient.post<EvaluationResponse>("/evaluate", payload);
  return response.data;
};

export const fetchSessionDetail = async (sessionId: number): Promise<SessionDetail> => {
  const response = await apiClient.get<SessionDetail>(`/sessions/${sessionId}`);
  return response.data;
};

export const fetchHistory = async (params?: {
  role?: string;
  level?: RoleLevel;
  limit?: number;
}): Promise<HistoryItem[]> => {
  const response = await apiClient.get<HistoryItem[]>("/history", { params });
  return response.data;
};

export const fetchDiagnostics = async (): Promise<DiagnosticsResponse> => {
  const response = await apiClient.get<DiagnosticsResponse>("/diagnostics");
  return response.data;
};
