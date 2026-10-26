import { memo, useEffect } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { bindProfileCache, initAuth } from "./authService";

type AuthBootstrapProps = {
  children: ReactNode;
};

const AuthBootstrap = ({ children }: AuthBootstrapProps) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Profil ilova keshi orqali olinadi (z87E6tdQ) — `useSettings` / `useGetMyProfile` uni qayta so'ramaydi.
    bindProfileCache(queryClient);
    void initAuth();
    return () => bindProfileCache(null);
  }, [queryClient]);

  return <>{children}</>;
};

export default memo(AuthBootstrap);
