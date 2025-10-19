import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { evaluateAnswer, fetchQuestions, fetchSessionDetail, submitAnswer } from "../api/interview";
import type { Evaluation, Question, RoleLevel } from "../api/types";
import { AnswerComposer } from "../components/interview/AnswerComposer";
import { FeedbackPanel } from "../components/interview/FeedbackPanel";
import { QuestionPrompt } from "../components/interview/QuestionPrompt";
import { SessionStats } from "../components/interview/SessionStats";
import { TimerDisplay } from "../components/interview/TimerDisplay";
import { useInterviewSession } from "../hooks/useInterviewSession";
import { formatDateTime } from "../utils/formatters";
import { getRoleLevelLabel } from "../utils/levels";
import { getQuestionTargetForLevel } from "../utils/questionTargets";
import { SessionSummaryModal } from "../components/interview/SessionSummaryModal";

const categoryCycle = ["behavioral", "technical", "role_specific"] as const;

export const InterviewPage = () => {
  const params = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { activeSession, startSession } = useInterviewSession();
  const sessionId = Number(params.sessionId);

  const [questionVersion, setQuestionVersion] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [latestEvaluation, setLatestEvaluation] = useState<Evaluation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(sessionId)) {
      navigate("/");
    }
  }, [navigate, sessionId]);

  const sessionQuery = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fetchSessionDetail(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  useEffect(() => {
    if (sessionQuery.data && !activeSession) {
      startSession({
        id: sessionQuery.data.id,
        roleName: sessionQuery.data.role.name,
        roleSlug: sessionQuery.data.role.slug,
        level: sessionQuery.data.level,
        startedAt: sessionQuery.data.started_at,
      });
    }
  }, [activeSession, sessionQuery.data, startSession]);

  const effectiveRoleSlug = activeSession?.roleSlug ?? sessionQuery.data?.role.slug;
  const activeLevel: RoleLevel = useMemo(() => {
    return activeSession?.level ?? sessionQuery.data?.level ?? "entry";
  }, [activeSession?.level, sessionQuery.data?.level]);

  const activeCategory = useMemo(() => {
    return categoryCycle[questionVersion % categoryCycle.length];
  }, [questionVersion]);

  const questionTarget = useMemo(() => getQuestionTargetForLevel(activeLevel), [activeLevel]);
  const answersCompleted = sessionQuery.data?.answers.length ?? 0;
  const isSessionComplete = answersCompleted >= questionTarget;

  const questionQuery = useQuery({
    queryKey: ["question", effectiveRoleSlug, activeCategory, activeLevel, questionVersion],
    queryFn: async () => {
      if (!effectiveRoleSlug) return null;
      const results = await fetchQuestions({
        role: effectiveRoleSlug,
        category: activeCategory,
        level: activeLevel,
        limit: 1,
      });
      return results[0] ?? null;
    },
    enabled: Boolean(effectiveRoleSlug) && !isSessionComplete,
  });

  useEffect(() => {
    if (questionQuery.data && !isSessionComplete) {
      setQuestion(questionQuery.data);
      setAnswerText("");
      setLatestEvaluation(null);
      setErrorMessage(null);
      const now = new Date();
      setStartTime(now);
      setElapsedSeconds(0);
      setIsTimerRunning(true);
    }
  }, [questionQuery.data, isSessionComplete]);

  useEffect(() => {
    if (!isTimerRunning || !startTime) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startTime.getTime()) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isTimerRunning, startTime]);

  useEffect(() => {
    setIsTimerRunning(false);
  }, [sessionId]);

  useEffect(() => {
    setQuestionVersion(0);
    setShowSummaryModal(false);
  }, [sessionId]);

  useEffect(() => {
    if (isSessionComplete) {
      setQuestion(null);
      setIsTimerRunning(false);
      setShowSummaryModal(true);
    }
  }, [isSessionComplete]);

  const submitAnswerMutation = useMutation({
    mutationFn: async () => {
      if (!question) {
        throw new Error("No question available to answer. Please load another question.");
      }
      if (!startTime) {
        throw new Error("Timer has not started yet. Try resetting the timer.");
      }
      const endTime = new Date();
      const answer = await submitAnswer(sessionId, {
        question_id: question.id,
        answer_text: answerText,
        started_at: startTime.toISOString(),
        ended_at: endTime.toISOString(),
      });
      const evaluation = await evaluateAnswer(answer.id);
      setLatestEvaluation(evaluation);
      setIsTimerRunning(false);
      return answer;
    },
    onSuccess: () => {
      setErrorMessage(null);
      sessionQuery.refetch();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unable to evaluate the answer. Try again.";
      setErrorMessage(message);
    },
  });

  const isBusy = submitAnswerMutation.isPending || questionQuery.isFetching;
  const currentQuestionNumber = isSessionComplete
    ? questionTarget
    : Math.min(answersCompleted + (question ? 1 : 0), questionTarget);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {sessionQuery.data?.role.name ?? "Interview Session"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Level: {getRoleLevelLabel(activeLevel)} - Started {formatDateTime(sessionQuery.data?.started_at)}
          </p>
          <p className="mt-2 inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Question {currentQuestionNumber} of {questionTarget}
          </p>
        </div>
        <TimerDisplay
          elapsedSeconds={elapsedSeconds}
          isRunning={isTimerRunning}
          onReset={() => {
            setStartTime(new Date());
            setElapsedSeconds(0);
            setIsTimerRunning(true);
          }}
        />
      </div>

      {sessionQuery.isError ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          Unable to load session details. Please verify the backend is running.
        </div>
      ) : (
        <SessionStats session={sessionQuery.data ?? null} />
      )}

      {question ? (
        <QuestionPrompt question={question} />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {questionQuery.isLoading
            ? "Preparing your next question..."
            : questionQuery.isError
            ? "Unable to fetch a question. Please try again."
            : "No question available."}
        </div>
      )}

      <AnswerComposer
        answerText={answerText}
        setAnswerText={setAnswerText}
        onSubmit={() => submitAnswerMutation.mutate()}
        isSubmitting={submitAnswerMutation.isPending}
        disabled={!question || isSessionComplete}
        requiresCode={Boolean(question?.requires_code)}
      />

      {errorMessage ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      <FeedbackPanel evaluation={latestEvaluation} />

      {isSessionComplete ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand/5 px-4 py-3 text-sm text-brand dark:border-brand-light/40 dark:bg-brand-light/10 dark:text-brand-light">
          <span>Session complete! Review your tailored summary to plan the next practice run.</span>
          <button
            type="button"
            className="rounded-lg border border-brand px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/10 dark:border-brand-light dark:text-brand-light dark:hover:bg-brand-light/10"
            onClick={() => setShowSummaryModal(true)}
          >
            View summary
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-light dark:hover:text-brand-light"
            onClick={() => {
              setQuestionVersion((prev) => prev + 1);
            }}
            disabled={isBusy || !question}
          >
            Next question
          </button>
          <p className="text-xs text-slate-400">
            Rotate focus automatically: {activeCategory.replace("-", " ")} prompt in progress.
          </p>
        </div>
      )}

      <SessionSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        session={sessionQuery.data ?? null}
        answersCompleted={answersCompleted}
        questionTarget={questionTarget}
      />
    </div>
  );
};
