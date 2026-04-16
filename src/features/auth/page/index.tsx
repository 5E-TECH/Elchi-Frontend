import { memo } from "react";
import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import type { RootState } from "../../../app/config/store";

const Auth = () => {
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  const isAppInitializing = useSelector((state: RootState) => state.user.isAppInitializing);

  if (isAppInitializing) {
    return null;
  }

  return isAuthenticated ? <Outlet /> : <Navigate replace to="/login" />;
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

  if (!token) {
    return <Navigate replace to="/login" />;
  }

  if (loading) return null;

  return valid ? <Outlet /> : <Navigate replace to="/login" />;
};

export default memo(Auth);
