import { memo } from "react";
import LoginForm from "./ui/LoginForm";

const Login = () => {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <LoginForm />
    </div>
  );
};

export default memo(Login);
