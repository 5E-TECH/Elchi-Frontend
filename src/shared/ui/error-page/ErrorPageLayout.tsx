import type { ReactNode } from "react";

interface ErrorPageLayoutProps {
  children: ReactNode;
}

const PARTICLE_CLASSES = [
  "error-page-particle-1",
  "error-page-particle-2",
  "error-page-particle-3",
  "error-page-particle-4",
  "error-page-particle-5",
  "error-page-particle-6",
  "error-page-particle-7",
  "error-page-particle-8",
  "error-page-particle-9",
  "error-page-particle-10",
  "error-page-particle-11",
  "error-page-particle-12",
];

const ErrorPageLayout = ({ children }: ErrorPageLayoutProps) => {
  return (
    <section className="error-page-shell relative flex min-h-[calc(100vh-13rem)] w-full flex-col overflow-hidden rounded-[2rem] px-4 py-8 text-primary">
      {PARTICLE_CLASSES.map((particleClass) => (
        <span key={particleClass} className={`error-page-particle ${particleClass}`} />
      ))}
      <div className="relative z-10 flex min-h-full flex-1 flex-col items-center justify-center">
        {children}
      </div>
    </section>
  );
};

export default ErrorPageLayout;
