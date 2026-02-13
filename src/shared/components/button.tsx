import { memo, type ReactNode } from "react";

interface ButtonProps {
  label: string;
  onClick?: () => void;
  icon?: ReactNode;
  type?: "submit" | "button" | "reset";
}

const Button = ({ label, onClick, icon, type = "button" }: ButtonProps) => {
  return (
    <button
      type={type}
      onClick={onClick}
      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-main text-white font-medium rounded-xl hover:bg-main/90 active:scale-95 transition-all duration-200 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon && <span className="flex items-center">{icon}</span>}
      <span>{label}</span>
    </button>
  );
};

export default memo(Button);
