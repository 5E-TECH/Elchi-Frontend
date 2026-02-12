import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import type { User } from "../../../entities/user/model/types";

export const login = "login";

// Response interface definitions
interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: User;
  };
  message?: string;
}

export const useLogin = () => {
  const client = useQueryClient();

  const signinUser = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await api.post<LoginResponse>("user/signin", credentials);

      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.message || "Login failed");
    },
    onSuccess: () => client.invalidateQueries({ queryKey: [login] }),
  });


  return {
    signinUser
  };
};