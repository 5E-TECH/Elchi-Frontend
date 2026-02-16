import { memo } from "react";
import { Search, Bell, User, Moon, Sun } from "lucide-react";
import { useTheme } from "../../../app/providers/theme/ThemeContext";

const Header = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between dark:bg-maindark px-6 py-4 bg-sidebar backdrop-blur-md  transition-colors duration-300">
      {/* Search Bar */}
      <div className="flex items-center bg-white border border-primary     rounded-xl px-4 py-2 w-96 max-md:w-auto focus-within:ring-2 focus-within:ring-[--main] transition-all">
        <Search className="text-black w-5 h-5" />
        <input
          type="text"
          placeholder="Qidiruv..."
          className="bg-transparent border-none outline-none ml-3 w-full text-black placeholder-black max-md:hidden"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl hover:bg-[--main]/10 text-maindark dark:text-primary transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon size={22} /> : <Sun size={22} />}
        </button>

        {/* Notifications */}
        <button className="relative p-2.5 rounded-xl hover:bg-[--main]/10 text-maindark dark:text-primary transition-colors">
          <Bell className="w-6 h-6" />
          <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[--bg-default]"></span>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-4 border-l border-[--border-default] cursor-pointer hover:opacity-80 transition-opacity">
          <div className="text-right max-md:hidden text-maindark dark:text-primary">
            <h4 className="text-sm font-bold">Admin User</h4>
            <p className="text-xs ">Super Admin</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-main flex items-center justify-center shadow-md shadow-main/20">
            <User color="#ffffff" className="w-5 h-5" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default memo(Header);
