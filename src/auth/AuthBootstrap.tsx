import { memo, useEffect } from "react";
import type { ReactNode } from "react";
import { initAuth } from "./authService";

type AuthBootstrapProps = {
  children: ReactNode;
};

const AuthBootstrap = ({ children }: AuthBootstrapProps) => {
  useEffect(() => {
    void initAuth();
  }, []);

  return <>{children}</>;
};

export default memo(AuthBootstrap);
