import { memo } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import type { RootState } from "../../app/config/store";
import LoginForm from "./ui/LoginForm";

const Login = () => {
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  const isAppInitializing = useSelector((state: RootState) => state.user.isAppInitializing);

  if (!isAppInitializing && isAuthenticated) {
    return <Navigate replace to="/" />;
  }

  return (
    <div className="min-h-dvh w-full flex">
      <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-maindark px-4 py-5 sm:p-12">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <svg
            className="w-full h-full"
            viewBox="0 0 400 400"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M 130 1 Q 200 85 270 1" fill="none" stroke="white" strokeLinecap="round" />
            <path d="M 80 0 Q 160 120 160 250 L 160 400" fill="none" stroke="white" strokeLinecap="round" />
            <path d="M 320 0 Q 240 120 240 250 L 240 400" fill="none" stroke="white" strokeLinecap="round" />
            <path d="M 0 90 Q 90 140 100 280 L 100 400" fill="none" stroke="white" strokeLinecap="round" />
            <path d="M 400 90 Q 310 140 300 280 L 300 400" fill="none" stroke="white" strokeLinecap="round" />
            <path d="M 0 180 Q 40 220 45 320 L 45 400" fill="none" stroke="white" strokeLinecap="round" />
            <path d="M 0 330 Q 30 360 45 400" fill="none" stroke="white" strokeLinecap="round" />
            <path d="M 400 180 Q 360 220 355 320 L 355 400" fill="none" stroke="white" strokeLinecap="round" />
            <path d="M 400 330 Q 370 360 355 400" fill="none" stroke="white" strokeLinecap="round" />
          </svg>
        </div>
        <div className="relative z-10 w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  );
};

export default memo(Login);
