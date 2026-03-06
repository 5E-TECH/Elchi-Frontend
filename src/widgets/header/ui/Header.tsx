import { memo, useState } from "react";
import { Search, Bell, Moon, Sun, LogOut, User, Menu, X } from "lucide-react";
import { useTheme } from "../../../app/providers/theme/ThemeContext";
import { useLogout } from "../../../shared/lib/useLogout";
import LogoText from "../../../shared/assets/logo yozuvlik qora.png";
import LogoTextdark from "../../../shared/assets/logo yozuvlik oq.png";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const { logout } = useLogout();
  const { theme, toggleTheme } = useTheme();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between dark:bg-maindark px-4 md:px-6 py-3 md:py-4 bg-sidebar backdrop-blur-md transition-colors duration-300 shadow-sm border-b border-black/5 dark:border-white/5 h-17.5 md:h-auto">
      {/* Mobile Search Overlay */}
      {isSearchOpen && (
        <div className="absolute inset-0 z-50 bg-sidebar dark:bg-maindark px-4 flex items-center animate-fade-in md:hidden">
          <div className="flex items-center bg-white border border-primary rounded-xl px-4 py-2 w-full shadow-lg shadow-main/10">
            <Search className="text-black w-5 h-5 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Qidiruv..."
              className="bg-transparent border-none outline-none ml-3 w-full text-black placeholder-black/50"
            />
          </div>
          <button
            onClick={() => setIsSearchOpen(false)}
            className="ml-3 p-2 rounded-xl text-maindark dark:text-primary hover:bg-main/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Mobile Logo */}
      <div className={`md:hidden ${isSearchOpen ? 'hidden' : 'block animate-fade-in'}`}>
        <img
          src={theme === "dark" ? LogoTextdark : LogoText}
          alt="Logo"
          className="h-28 w-auto object-contain"
          onDoubleClick={() => setIsSearchOpen(true)}
        />
      </div>

      {/* Search Bar - Desktop Only */}
      <div className="hidden md:flex items-center bg-white border border-primary rounded-xl px-4 py-2 w-full max-w-96 overflow-hidden md:w-96 transition-all duration-300 group">
        <Search className="text-black w-5 h-5 shrink-0" />
        <input
          type="text"
          placeholder="Qidiruv..."
          className="bg-transparent border-none outline-none ml-3 w-full text-black placeholder-black"
        />
      </div>

      {/* Right Actions */}
      <div className={`flex items-center gap-3 md:gap-4 shrink-0 ${isSearchOpen ? 'hidden md:flex' : 'flex'}`}>
        {/* Mobile Search Button */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="md:hidden p-2 rounded-xl text-maindark dark:text-primary hover:bg-main/10 transition-colors"
          aria-label="Open search"
        >
          <Search className="w-5.5 h-5.5" />
        </button>

        {/* Mobile Hamburger - Only Mobile */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-xl text-maindark dark:text-primary hover:bg-main/10 transition-colors"
        >
          <Menu className="w-7 h-7" />
        </button>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2 md:gap-4 shrink-0">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 md:p-2.5 rounded-xl hover:bg-[--main]/10 text-maindark dark:text-primary transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon className="w-5 h-5 md:w-5.5 md:h-5.5" /> : <Sun className="w-5 h-5 md:w-5.5 md:h-5.5" />}
          </button>

          {/* Notifications */}
          <button className="relative p-2 md:p-2.5 rounded-xl hover:bg-[--main]/10 text-maindark dark:text-primary transition-colors">
            <Bell className="w-5 h-5 md:w-6 md:h-6" />
            <span className="absolute top-2 right-2 w-2 h-2 md:w-2.5 md:h-2.5 bg-red-500 rounded-full border-2 border-[--bg-default]"></span>
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="p-2 md:p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 group"
            title="Chiqish"
          >
            <LogOut className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-[--border-default] cursor-pointer hover:opacity-80 transition-opacity">
            <div className="text-right hidden md:block text-maindark dark:text-primary">
              <h4 className="text-sm font-bold">Admin User</h4>
              <p className="text-xs ">Super Admin</p>
            </div>
            <div onClick={() => navigate("profile")} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-main flex items-center justify-center shadow-md shadow-main/20">
              <User color="#ffffff" className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default memo(Header);
