import authService from "../../auth/authService";

export const useLogout = () => {
  const logout = async () => {
    await authService.logoutAndRedirect();
  };

  return { logout };
};
