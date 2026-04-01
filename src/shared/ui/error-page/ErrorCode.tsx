import logo from "../../assets/logoowhite.png";

interface ErrorCodeProps {
  leftDigit: string;
  rightDigit: string;
  subtitle: string;
}

const ErrorCode = ({ leftDigit, rightDigit, subtitle }: ErrorCodeProps) => {
  return (
    <div className="flex w-full items-center justify-center gap-6 sm:gap-8 lg:gap-10">
      <span className="error-page-digit translate-x-1 text-[7.4rem] font-black leading-none tracking-[-0.16em] sm:translate-x-2 sm:text-[10rem] lg:translate-x-3 lg:text-[12rem]">
        {leftDigit}
      </span>

      <div className="mx-0 flex flex-col items-center">
        <div className="relative flex h-56 w-56 shrink-0 items-center justify-center rounded-full sm:h-64 sm:w-64">
          <div className="error-page-ring-outer" />
          <div className="error-page-ring-dashed animate-spin-ring-rev" />
          <div className="error-page-ring-spin" />
          <div className="error-page-ring-core animate-pulse-glow">
            <img
              src={logo}
              alt="Elchi Logo"
              className="error-page-logo-glow relative z-10 h-24 w-auto object-contain opacity-95 sm:h-28"
              draggable={false}
            />
          </div>
        </div>

        <p className="error-page-muted mt-5 text-center text-xs font-semibold uppercase tracking-[0.38em]">
          {subtitle}
        </p>
      </div>

      <span className="error-page-digit -translate-x-1 text-[7.4rem] font-black leading-none tracking-[-0.16em] sm:-translate-x-2 sm:text-[10rem] lg:-translate-x-3 lg:text-[12rem]">
        {rightDigit}
      </span>
    </div>
  );
};

export default ErrorCode;
