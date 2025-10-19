import { Outlet } from "react-router-dom";

import { ConsentModal } from "./ConsentModal";
import { Footer } from "./Footer";
import { Header } from "./Header";

export const AppLayout = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <ConsentModal />
    <Header />
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <Outlet />
    </main>
    <Footer />
  </div>
);
