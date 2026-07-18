import { memo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "../header/ui/Header";
import Footer from "../footer/ui/Footer";
import Sidebar from "../Sidebar/ui/Sidebar";
import BottomNav from "../Sidebar/ui/BottomNav";
import MobileMenu from "../Sidebar/ui/MobileMenu";

const DashboardLayout = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const isBranchDashboard = location.pathname === "/branch-dashboard";

  return (
    <div className="relative flex h-dvh overflow-hidden bg-sidebar font-sans text-main transition-colors duration-300 dark:bg-maindark">
      {/* Sidebar - Desktop only */}
      <Sidebar />

      {/* Main Content Wrapper */}
      <div className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden bg-sidebar dark:bg-maindark">

        {/* Header - Sticky */}
        <Header onMenuClick={() => setIsMenuOpen(true)} />

        {/* Content */}
        <main
          className={`el-surface-page mx-2 mb-0 flex-1 rounded-[1rem] bg-[color:var(--color-page-surface)] p-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] custom-scrollbar dark:bg-[color:var(--color-surface-elevated-dark)] sm:mx-4 sm:rounded-[1.35rem] sm:p-4 sm:pb-[calc(6rem+env(safe-area-inset-bottom))] md:ml-0 md:mr-3 md:mb-0 md:border-l-0 md:shadow-none md:p-5 md:pb-5 xl:p-6 xl:pb-6 ${
            isBranchDashboard ? "overflow-y-auto xl:overflow-hidden" : "overflow-y-auto"
          }`}
        >
          <Outlet />
        </main>

        {/* Footer - doim pastda */}
        <Footer />
      </div>

      {/* Mobile Navigation */}
      <BottomNav />

      {/* Mobile Drawer Menu */}
      <MobileMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />
    </div>
  );
};

export default memo(DashboardLayout);
