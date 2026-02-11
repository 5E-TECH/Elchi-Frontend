import { lazy, memo } from "react";
import { useRoutes } from "react-router-dom";

const Login = lazy(() => import("../../features/auth/ui/LoginForm"));
const DashboardLayout = lazy(() => import("../../widgets/layout/dashboardLayout"))
const DashboardPage = lazy(() => import("../../pages/dashboard/DashboardPage"))


const AppRouter = () => {
  return useRoutes([{ path: "/", element: <Login /> },
    {path:"/dashboard", element:<DashboardLayout/>,
      children:[
        {index:true, element:<DashboardPage/>}
      ]
    }
  ]);
};

export default memo(AppRouter)