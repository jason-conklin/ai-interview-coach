import { useContext } from "react";

import { InterviewSessionContext } from "../context/InterviewSessionContext";
import type { ActiveSession } from "../context/InterviewSessionContext";

export const useInterviewSession = () => {
  const context = useContext(InterviewSessionContext);
  if (!context) {
    throw new Error("useInterviewSession must be used within an InterviewSessionProvider");
  }

  const { activeSession, setActiveSession, clearSession } = context;

  const startSession = (session: ActiveSession) => {
    setActiveSession(session);
  };

  return {
    activeSession,
    startSession,
    clearSession,
  };
};
