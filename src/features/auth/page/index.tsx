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
import { API_ENDPOINTS } from "../../../shared/api";
import { logout, setAppInitializing, setProfile } from "../../../entities/user/model/slice";

const Auth = () => {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.user.accessToken);
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    if (!token) {
      dispatch(setAppInitializing(false));
      setLoading(false);
      return;
    }

    api
      .get(API_ENDPOINTS.AUTH.MY_PROFILE)
      .then((res) => {
        setValid(true);
        const userData = res.data?.data;

        if (userData) {
          dispatch(setProfile(userData));
          dispatch(setRole(userData.role));
          dispatch(setId(userData.id));
          if (userData.region?.name) {
            dispatch(setRegion(userData.region.name));
          }
        }
      })
      .catch(() => {
        dispatch(logout());
        setValid(false);
      })
      .finally(() => {
        dispatch(setAppInitializing(false));
        setLoading(false);
      });
  }, [token, dispatch]);

  if (loading) return null;

  return valid ? <Outlet /> : <Navigate replace to="/login" />;
};

export default memo(Auth);
