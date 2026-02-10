import { lazy, memo } from "react";
import { useRoutes } from "react-router-dom";

const Login = lazy(() => import("../../features/auth/ui/LoginForm"));

const AppRouter = () => {
  return useRoutes([{ path: "/", element: <Login /> }]);
};

export default memo(AppRouter)