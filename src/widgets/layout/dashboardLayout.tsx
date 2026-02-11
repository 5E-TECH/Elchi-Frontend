import { memo } from "react";
import { Outlet } from "react-router-dom";
import Header from "../header";
import Footer from "../footer";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/config/store";
import Sidebar from "../Sidebar//ui/Sidebar";
// import type { UserRole } from "./model/menuConfig";

const DashboardLayout = () => {
  const sidebarRedux = useSelector((state: RootState) => state.sidebar);
  // User role'ni Redux dan oling
  // const userRole = useSelector((state: RootState) => state.auth.role) as UserRole;

  return (
    <div
      className={`h-screen grid grid-rows-[auto_1fr_auto] max-[650px]:grid-cols-[1fr] bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5] pr-4 relative transition-all duration-300 ease-in-out ${
        !sidebarRedux.isOpen ? "grid-cols-[60px_1fr]" : "grid-cols-[250px_1fr]"
      }`}
    >
      {/* Navbar */}
      <div className="col-span-2 max-[650px]:col-span-1">
        <Header />
      </div>

      {/* Sidebar */}
      <aside className="row-span-1 overflow-y-auto bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)] max-[650px]:hidden">
        <Sidebar />
      </aside>

      {/* Dashboard container */}
      <div className="overflow-y-auto bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)] pl-4 pb-8">
        <main className="w-full h-full bg-[#fff] dark:bg-[#312d48] rounded-4xl overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <div className="col-span-2 max-[650px]:col-span-1 py-3">
        <Footer />
      </div>
    </div>
  );
};

export default memo(DashboardLayout);