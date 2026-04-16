import { memo } from "react";
import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import type { RootState } from "../../../app/config/store";

const Auth = () => {
  const isAuthenticated = useSelector(
    (state: RootState) => state.user.isAuthenticated,
  );
  const isAppInitializing = useSelector(
    (state: RootState) => state.user.isAppInitializing,
  );

  if (isAppInitializing) {
    return null;
  }

  return isAuthenticated ? <Outlet /> : <Navigate replace to="/login" />;
};

export default memo(Auth);
