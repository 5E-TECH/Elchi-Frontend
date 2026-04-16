import { useMutation } from "@tanstack/react-query";
import authService from "../../../auth/authService";

export const login = "login";

export const useLogin = () => {
  const signinUser = useMutation({
    mutationFn: authService.login,
  });

  return {
    signinUser,
  };
};
