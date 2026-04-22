import { memo, type ReactNode } from "react";

interface HeaderNameProps {
  name: string;
  description?: string;
  icon: ReactNode;
  onIconClick?: () => void;
}

const HeaderName = ({ name, description, icon, onIconClick }: HeaderNameProps) => {
  return (
    <div className="flex w-fit min-w-[230px] max-w-full items-center gap-3.5 py-2.5 text-maindark">
      <div
        onClick={onIconClick}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-main text-primary shadow-lg dark:bg-primary/10 dark:text-primary [&_svg]:!h-5 [&_svg]:!w-5 [&_svg]:!text-current ${onIconClick ? "cursor-pointer transition-colors hover:bg-main/85 dark:hover:bg-primary/15" : ""}`}
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="m-0 truncate text-[18px] font-extrabold leading-tight text-main dark:text-primary">
          {name}
        </h2>
        {description && (
          <p className="m-0 truncate text-[12.5px] font-semibold leading-tight text-main/70 dark:text-primary/80">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default memo(HeaderName);
