import { memo, type ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

const PageContainer = ({ children, className = "" }: PageContainerProps) => (
  <div className={`min-h-full ${className}`.trim()}>{children}</div>
);

export default memo(PageContainer);
