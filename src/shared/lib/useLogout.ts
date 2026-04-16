import authService from "../../auth/authService";

export const useLogout = () => {
  const logout = async () => {
    await authService.logoutAndRedirect();
  };

  return { logout };
    const logout = () => {
        // 1. Clear LocalStorage
        localStorage.removeItem("accessToken");
        localStorage.removeItem("name");
        localStorage.removeItem("theme"); // Optional, maybe keep theme? I'll clear just in case

        // 2. Clear Redux State
        dispatch(removeRole());

        // 3. Redirect to Login
        navigate("/login");
    };

    return { logout };
};
