import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import type { RoleLevel } from "../api/types";

export type ActiveSession = {
  id: number;
  roleSlug: string;
  roleName: string;
  level: RoleLevel;
  startedAt: string;
};

type InterviewSessionContextValue = {
  activeSession: ActiveSession | null;
  setActiveSession: (value: ActiveSession) => void;
  clearSession: () => void;
};

const STORAGE_KEY = "ai-coach-active-session";

export const InterviewSessionContext = createContext<InterviewSessionContextValue | undefined>(
  undefined,
);

const DEFAULT_LEVEL: RoleLevel = "entry";

export const InterviewSessionProvider = ({ children }: PropsWithChildren) => {
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<ActiveSession>;
      if (!parsed) {
        return null;
      }
      return {
        id: parsed.id ?? 0,
        roleSlug: parsed.roleSlug ?? "",
        roleName: parsed.roleName ?? "",
        level: (parsed.level ?? DEFAULT_LEVEL) as RoleLevel,
        startedAt: parsed.startedAt ?? new Date().toISOString(),
      } satisfies ActiveSession;
    } catch (error) {
      console.warn("Unable to parse persisted session", error);
      return null;
    }
  });

  useEffect(() => {
    if (activeSession) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activeSession));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [activeSession]);

  const setActiveSession = useCallback((value: ActiveSession) => {
    setActiveSessionState(value);
  }, []);

  const clearSession = useCallback(() => {
    setActiveSessionState(null);
  }, []);

  const value = useMemo(
    () => ({
      activeSession,
      setActiveSession,
      clearSession,
    }),
    [activeSession, clearSession, setActiveSession],
  );

  return (
    <InterviewSessionContext.Provider value={value}>
      {children}
    </InterviewSessionContext.Provider>
  );
};
