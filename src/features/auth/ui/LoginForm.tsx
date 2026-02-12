import { memo, useState } from "react";
import logo from "../../../shared/assets/logo yozuvlik qora.png";
import { Eye, EyeClosed, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { loginSchema } from "../../../shared/lib/validation/loginSchema";
import {
  loginSuccess,
  setLoading,
  setError,
} from "../../../entities/user/model/slice";
import type { RootState, AppDispatch } from "../../../app/config/store";
import { useLogin } from "../api/login";

const LoginForm = () => {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const loading = useSelector((state: RootState) => state.user.loading);
  const error = useSelector((state: RootState) => state.user.error);

  const { signinUser } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(loginSchema),
    mode: "onTouched",
    defaultValues: {
      username: "",
    },
  });

  const onSubmit = (data: any) => {
    dispatch(setLoading(true));
    dispatch(setError(null));

    signinUser.mutate(
      { username: data.username, password: data.password },
      {
        onSuccess: (responseData: any) => {
          dispatch(loginSuccess(responseData));
          navigate("/dashboard");
        },
        onError: (err: any) => {
          let message = "Tizim hatoligi";
          if (err.response) {
            const status = err.response.status;
            if (status === 400) message = "Noto'g'ri ma'lumot kiritildi";
            if (status === 401)
              message = "Parol noto'g'ri yoki foydalanuvchi topilmadi";
            if (status === 404) message = "Bunday foydalanuvchi mavjud emas";
            if (status === 500) message = "Serverda xatolik yuz berdi";
          } else {
            message = err.message || "Tarmoq xatoligi";
          }

          dispatch(setError(message));
        },
      },
    );
  };

  return (
    <div className="flex items-center justify-center">
      <div className="bg-primary pb-8 sm:px-10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-115 max-w-full mx-4">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="flex justify-center">
            <img src={logo} alt="Elchi Logo" className="w-50" />
          </div>

          <div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">
                Username
              </label>
              <input
                {...register("username")}
                type="text"
                disabled={loading}
                className={`w-full h-12 px-4 text-maindark bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-maindark focus:border-transparent transition-all duration-200 ${errors.username ? "border-red-500" : "border-gray-200"
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                placeholder="Username"
              />
              {errors.username && (
                <p className="text-red-500 text-xs mt-1 ml-1">
                  {errors.username.message as string}
                </p>
              )}
            </div>

            {/* Parol */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-1 ml-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Parol
                </label>
              </div>
              <div
                className={`flex justify-between items-center w-full h-12 px-4 text-maindark bg-gray-50 border rounded-xl focus-within:ring-2 focus-within:ring-maindark focus-within:border-transparent transition-all duration-200 ${errors.password ? "border-red-500" : "border-gray-200"
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input
                  {...register("password")}
                  type={show ? "text" : "password"}
                  disabled={loading}
                  placeholder="••••••••"
                  className="w-full outline-none bg-transparent"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShow(!show)}
                  className="cursor-pointer focus:outline-none text-gray-400 hover:text-main transition-colors disabled:cursor-not-allowed "
                >
                  {show ? <Eye size={20} /> : <EyeClosed size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1 ml-1">
                  {errors.password.message as string}
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-500 text-sm text-center mb-4 bg-red-50 p-2 rounded-lg border border-red-100">
                {error}
              </div>
            )}

            {/* Kirish tugmasi */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full h-12 rounded-xl font-semibold text-lg shadow-lg transition-all duration-200 mt-4 flex items-center justify-center gap-2 mb-2 ${loading
                ? "bg-maindark/70 text-primary cursor-not-allowed shadow-none translate-y-0"
                : "bg-maindark text-primary shadow-main/30 hover:shadow-main/40 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                }`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Yuklanmoqda...
                </>
              ) : (
                "Tizimga kirish"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default memo(LoginForm);
