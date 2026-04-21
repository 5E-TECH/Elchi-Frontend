import { memo } from "react";
import { Outlet } from "react-router-dom";

const ScanLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-sidebar text-main transition-colors duration-300 dark:bg-maindark">
      <main className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6">
        <div className="mx-auto w-full max-w-[1440px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default memo(ScanLayout);
