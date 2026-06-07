import { memo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import Header from "../header";
import Footer from "../footer";
import { Outlet } from "react-router-dom";
import { resetFilters } from "../../features/Select/model/FilterSlice";

const MainLayout = () => {
  const location = useLocation();
  const dispatch = useDispatch();

  // Pathname o'zgarganda Redux filter ni tozlash
  useEffect(() => {
    dispatch(resetFilters());
  }, [location.pathname, dispatch]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F5FA] dark:bg-dark-bg-py dark:text-[#E7E3FCE5] transition-all duration-300 ease-in-out">
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
