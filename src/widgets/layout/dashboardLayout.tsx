import { memo } from "react";
import { Outlet } from "react-router-dom";
import Header from "../header/ui/Header"; // Adjusted import path
import Footer from "../footer/ui/Footer"; // Adjusted import path
import Sidebar from "../Sidebar/ui/Sidebar"; // Adjusted import path

const DashboardLayout = () => {
  return (
    <div className="flex min-h-screen font-sans text-main transition-colors duration-300 relative">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Wrapper - Flex Column for Sticky Footer */}
      <div className="flex-1 flex flex-col min-h-screen">

        {/* Header - Sticky */}
        <Header />

        {/* Content - Grows to fill space */}
        <main className="flex-1 p-4 md:p-6 custom-scrollbar">
          <Outlet />
        </main>

        {/* Footer - Stays at bottom naturally due to flex-1 above */}
        <Footer />

      </div>
    </div>
  );
};

export default memo(DashboardLayout);