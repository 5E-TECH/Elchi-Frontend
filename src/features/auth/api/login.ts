import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import type { User } from "../../../entities/user/model/types";

export const login = "login";

// Response interface definitions
interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}


export const fetchProfile = async () => {
  const response = await api.get(API_ENDPOINTS.AUTH.MY_PROFILE);
  return response.data;
};

export const useLogin = () => {
  const client = useQueryClient();

  const signinUser = useMutation({
    mutationFn: async (credentials: { phone_number: string; password: string }) => {
      const response = await api.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, credentials);
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
