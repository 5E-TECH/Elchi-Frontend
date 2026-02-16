import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import type { User } from "../../../entities/user/model/types";

export const login = "login";

// Response interface definitions
interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}


export const fetchProfile = async () => {
  const response = await api.get("/auth/my-profile");
  return response.data;
};

export const useLogin = () => {
  const client = useQueryClient();

  const signinUser = useMutation({
    mutationFn: async (credentials: { phoneNumber: string; password: string }) => {
      const response = await api.post<LoginResponse>("/auth/login", credentials);
      return response.data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: [login] }),
  });


  const getProfile = () => useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  })

  return {
    signinUser,
    getProfile
  };
};