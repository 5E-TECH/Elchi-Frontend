import { memo, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";

interface ProtectedRouteProps {
  children: ReactNode;
  canActivate: (state: RootState) => boolean;
  redirectTo?: string;
}

const ProtectedRoute = ({
  children,
  canActivate,
  redirectTo = "/403",
}: ProtectedRouteProps) => {
  const navigate = useNavigate();
  // Subscribe to the derived permission only. Selecting the entire store made
  // every protected route re-render for unrelated search/pagination changes.
  const isAllowed = useSelector((state: RootState) => canActivate(state));

  useEffect(() => {
    if (!isAllowed) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAllowed, navigate, redirectTo]);

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
};

export default memo(ProtectedRoute);
