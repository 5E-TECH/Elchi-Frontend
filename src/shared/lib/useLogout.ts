import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { removeRole } from "../../features/auth/model/loginSlice";

export const useLogout = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const logout = () => {
        // 1. Clear LocalStorage
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("name");
        localStorage.removeItem("theme"); // Optional, maybe keep theme? I'll clear just in case

        // 2. Clear Redux State
        dispatch(removeRole());

        // 3. Redirect to Login
        navigate("/login");
    };

    return { logout };
};
