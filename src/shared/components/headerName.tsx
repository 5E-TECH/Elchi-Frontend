import { memo, type ReactNode } from "react";

interface HeaderNameProps {
  name: string;
  description?: string;
  icon: ReactNode;
}

const HeaderName = ({ name, description, icon }: HeaderNameProps) => {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl shadow-md ">
      <div className="flex items-center justify-center w-12 h-12 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
        {icon}
      </div>
      <div className="flex flex-col">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white m-0">
          {name}
        </h2>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 m-0 font-medium">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default memo(HeaderName);
