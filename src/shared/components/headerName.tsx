import { memo, type ReactNode } from "react";

interface HeaderNameProps {
  name: string;
  description?: string;
  icon: ReactNode;
  onIconClick?: () => void;
}

const HeaderName = ({ name, description, icon, onIconClick }: HeaderNameProps) => {
  return (
    <div className="flex items-center gap-2.5 py-2.5 rounded-2xl text-maindark">
      <div
        onClick={onIconClick}
        className={`flex items-center justify-center w-9 h-9 shadow-xl bg-main dark:bg-main/10 text-primary rounded-xl ${onIconClick ? "cursor-pointer hover:bg-main/80 transition-colors" : ""}`}
      >
        {icon}
      </div>
      <div className="flex flex-col">
        <h2 className="text-[16px] font-bold leading-tight text-main dark:text-primary m-0">
          {name}
        </h2>
        {description && (
          <p className="text-[11px] text-gray-500 dark:text-white m-0 font-medium">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default memo(HeaderName);
