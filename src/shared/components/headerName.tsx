import { memo, type ReactNode } from "react";

interface HeaderNameProps {
  name: string;
  description?: string;
  icon: ReactNode;
  onIconClick?: () => void;
  className?: string;
  iconClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

const HeaderName = ({
  name,
  description,
  icon,
  onIconClick,
  className = "",
  iconClassName = "",
  titleClassName = "",
  descriptionClassName = "",
}: HeaderNameProps) => {
  return (
    <div className={`flex w-full min-w-0 max-w-full items-center gap-3 py-2 text-maindark sm:w-fit sm:min-w-[230px] sm:gap-3.5 sm:py-2.5 ${className}`}>
      <div
        onClick={onIconClick}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-main text-primary shadow-lg sm:h-11 sm:w-11 dark:bg-primary/10 dark:text-primary [&_svg]:!h-5 [&_svg]:!w-5 [&_svg]:!text-current ${onIconClick ? "cursor-pointer transition-colors hover:bg-main/85 dark:hover:bg-primary/15" : ""} ${iconClassName}`}
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className={`m-0 truncate text-[16px] font-extrabold leading-tight text-main sm:text-[18px] dark:text-primary ${titleClassName}`}>
          {name}
        </h2>
        {description && (
          <p className={`m-0 truncate text-[12.5px] font-semibold leading-tight text-main/70 dark:text-primary/80 ${descriptionClassName}`}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default memo(HeaderName);
