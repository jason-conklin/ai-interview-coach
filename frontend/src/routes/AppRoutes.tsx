import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { HistoryPage } from "../pages/HistoryPage";
import { InterviewPage } from "../pages/InterviewPage";
import { LandingPage } from "../pages/LandingPage";
import { SessionDetailPage } from "../pages/SessionDetailPage";

export const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="/interview/:sessionId" element={<InterviewPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
