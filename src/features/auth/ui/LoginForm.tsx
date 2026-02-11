import { memo } from "react";
import logo from "../../../shared/assets/logoo.png";

const LoginForm = () => {
  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <div className="bg-primary p-8 sm:p-10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-[460px] max-w-full mx-4 border border-gray-50">
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col">
          {/* Logo va Brend nomi */}
          <div className="flex flex-col items-center mb-8">
            <div className="bg-main p-3 rounded-xl mb-4 shadow-lg">
              <img
                src={logo}
                alt="Elchi Logo"
                className="h-10 sm:h-12 w-auto"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight">
              Elchi <span className="text-main">Pochta</span>
            </h1>
          </div>

          <div className="space-y-5">
            {/* Telefon raqami */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">
                Telefon raqam
              </label>
              <input
                type="text"
                className="w-full h-12 px-4 text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-main/20 focus:border-main transition-all duration-200"
                placeholder="+998 90 123 45 67"
              />
            </div>

            {/* Parol */}
            <div>
              <div className="flex justify-between items-center mb-1 ml-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Parol
                </label>
              </div>
              <input
                type="password"
                className="w-full h-12 px-4 text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-main/20 focus:border-main transition-all duration-200"
                placeholder="••••••••"
              />
            </div>

            {/* Kirish tugmasi */}
            <button
              type="submit"
              className="bg-main w-full h-12 text-primary rounded-xl font-bold text-lg shadow-lg shadow-main/30 hover:shadow-main/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 mt-4"
            >
              Tizimga kirish
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default memo(LoginForm);
