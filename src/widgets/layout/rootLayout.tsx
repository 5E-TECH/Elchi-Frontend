import { memo } from "react";
import Header from "../header";
import Footer from "../footer";
import { Outlet } from "react-router-dom";

const MainLayout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5] transition-all duration-300 ease-in-out">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default memo(MainLayout);