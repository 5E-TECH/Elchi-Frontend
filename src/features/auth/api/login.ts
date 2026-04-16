import { useMutation } from "@tanstack/react-query";
import authService from "../../../auth/authService";

export const login = "login";

// Response interface definitions
interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}


export const fetchProfile = async () => {
  const response = await api.get(API_ENDPOINTS.AUTH.MY_PROFILE);
  return response.data;
};

export const useLogin = () => {
  const signinUser = useMutation({
    mutationFn: authService.login,
  });

  return {
    signinUser,
  };
};
