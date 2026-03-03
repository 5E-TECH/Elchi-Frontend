import { memo, useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../header/ui/Header";
import Footer from "../footer/ui/Footer";
import Sidebar from "../Sidebar/ui/Sidebar";
import BottomNav from "../Sidebar/ui/BottomNav";
import MobileMenu from "../Sidebar/ui/MobileMenu";

const DashboardLayout = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen font-sans text-main dark:bg-primarydark transition-colors duration-300 relative">
      {/* Sidebar - Desktop only */}
      <Sidebar />

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">

        {/* Header - Sticky */}
        <Header onMenuClick={() => setIsMenuOpen(true)} />

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 custom-scrollbar pb-24 md:pb-6">
          <Outlet />
        </main>

        {/* Footer */}
        <Footer />
      </div>

      {/* Mobile Navigation */}
      <BottomNav onMenuClick={() => setIsMenuOpen(true)} />

      {/* Mobile Drawer Menu */}
      <MobileMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />
    </div>
  );
};

export default memo(DashboardLayout);