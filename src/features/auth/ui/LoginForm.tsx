import { memo, useState } from "react";
import logo from "../../../shared/assets/logoo.png";
import { Eye, EyeClosed } from "lucide-react";

const LoginForm = () => {
  const [show, setShow] = useState(false);

  return (
    <div className="flex items-center justify-center">
      <div className="bg-primary p-8 sm:p-10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-115 max-w-full mx-4">
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-primarydark p-3 rounded-xl mb-4 shadow-lg">
              <img
                src={logo}
                alt="Elchi Logo"
                className="h-10 sm:h-12 w-auto"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primarydark tracking-tight">
              Elchi <span className="text-main">Pochta</span>
            </h1>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">
                Telefon raqam
              </label>
              <input
                type="text"
                className="w-full h-12 px-4 text-maindark bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-main focus:border-transparent transition-all duration-200"
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
              <div className="flex justify-between items-center w-full h-12 px-4 text-maindark bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-main focus-within:border-transparent transition-all duration-200">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full outline-none bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="cursor-pointer focus:outline-none text-gray-400 hover:text-main transition-colors"
                >
                  {show ? (
                    <Eye size={20} />
                  ) : (
                    <EyeClosed size={20} />
                  )}
                </button>
              </div>
            </div>

            {/* Kirish tugmasi */}
            <button
              type="submit"
              className="bg-primarydark w-full h-12 text-primary rounded-xl font-bold text-lg shadow-lg shadow-main/30 hover:shadow-main/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 mt-4 cursor-pointer"
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
