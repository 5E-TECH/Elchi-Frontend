import { memo, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import {
  setId,
  setRegion,
  setRole,
} from "../model/loginSlice";
import { api } from "../../../shared/api/api";
import { logout } from "../../../entities/user/model/slice";
// import Suspensee from "../../shared/ui/Suspensee";
// Test for deployment
const Auth = () => {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.user.accessToken);
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  console.log("token:", token);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("auth/my-profile")
      .then((res) => {
        console.log("my-profile response:", res); // ← Response ni ko'ring
        console.log("my-profile data:", res.data); // ← Data ni ko'ring
        
        setValid(true);
        
        // ✅ Safe access:
        const userData = res.data?.data;
        if (userData) {
          dispatch(setRole(userData.role));
          dispatch(setId(userData.id));
          if (userData.region?.name) {
            dispatch(setRegion(userData.region.name));
          }
        }
        
        console.log("auth success");
      })
      .catch((err) => {
        console.log("auth error:", err); // ← Xatoni ko'ring
        console.log("auth error response:", err.response); // ← Response ni ko'ring
        dispatch(logout());
        setValid(false);
      })
      .finally(() => setLoading(false));
  }, [token, dispatch]);

  if (loading)
    return (
      <div>
        <h2>loading...!!!</h2>
      </div>
    );

  return valid ? <Outlet /> : <Navigate replace to="/login" />;
};

export default memo(Auth);
