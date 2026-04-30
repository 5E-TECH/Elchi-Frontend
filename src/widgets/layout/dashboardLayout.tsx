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
    <div className="flex h-screen font-sans text-main dark:bg-primarydark transition-colors duration-300 relative overflow-hidden">
      {/* Sidebar - Desktop only */}
      <Sidebar />

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* Header - Sticky */}
        <Header onMenuClick={() => setIsMenuOpen(true)} />

        {/* Content */}
        <main
          className={`flex-1 p-3 sm:p-4 md:p-6 custom-scrollbar pb-24 md:pb-6 border rounded-[1.75rem] sm:rounded-4xl ${
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
