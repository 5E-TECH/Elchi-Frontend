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
  console.log(token);
  

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("auth/my-profile") // 🔑 backendda token tekshirish
      .then((res) => {
        setValid(true); // token to‘g‘ri bo‘lsa
        dispatch(setRole(res.data.data.role));
        dispatch(setId(res.data.data.id));
        // {
        //   res?.data?.data?.role === "market" &&
        //     dispatch(setTarif(res?.data?.data?.default_tariff));
        // }
        // {
        //   res?.data?.data?.role === "market" &&
        //     dispatch(
        //       setUserData({
        //         name: res?.data?.data?.name,
        //         phone_number: res?.data?.data?.phone_number,
        //       })
        //     );
        // }
        {
          res?.data?.data?.region?.name
            ? dispatch(setRegion(res?.data?.data?.region?.name))
            : "";
        }
      })
      .catch(() => {
        dispatch(logout()); // ❌ noto‘g‘ri token → localStorage va reduxdan o‘chir
        setValid(false);
      })
      .finally(() => setLoading(false));
  }, [token, dispatch]);

  if (loading)
    return (
      <div>
        {/* <Suspensee /> */}
        <h2>loading...!!!</h2>
      </div>
    );

  return valid ? <Outlet /> : <Navigate replace to="/login" />;
};

export default memo(Auth);
