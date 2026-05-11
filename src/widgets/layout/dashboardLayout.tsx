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
    <div className="relative flex h-screen overflow-hidden bg-sidebar font-sans text-main transition-colors duration-300 dark:bg-maindark">
      {/* Sidebar - Desktop only */}
      <Sidebar />

      {/* Main Content Wrapper */}
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-sidebar dark:bg-maindark">

        {/* Header - Sticky */}
        <Header onMenuClick={() => setIsMenuOpen(true)} />

        {/* Content */}
        <main
          className={`el-surface-page mx-3 mb-0 flex-1 rounded-[1.55rem] bg-[var(--color-page-surface)] p-4 pb-24 custom-scrollbar dark:bg-[#2b2741] sm:mx-4 sm:mb-0 md:ml-0 md:mr-3 md:mb-0 md:border-l-0 md:shadow-none md:p-6 md:pb-6 ${
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
