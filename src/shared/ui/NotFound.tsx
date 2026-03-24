import { memo } from "react";
import { ArrowLeft, Compass, House, SearchX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logoowhite.png";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 z-9998 flex flex-col items-center justify-center overflow-hidden px-4 py-8 text-primary animate-loader-in"
      style={{
        background:
          "linear-gradient(135deg, var(--color-background) 0%, var(--color-maindark) 52%, var(--color-purple-dark) 100%)",
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none animate-aurora">
        <div
          className="absolute left-[-10%] top-[-12%] h-md w-md rounded-full opacity-20 blur-[120px]"
          style={{ background: "var(--color-main)" }}
        />
        <div
          className="absolute bottom-[-14%] right-[-12%] h-120 w-120 rounded-full opacity-18 blur-[130px]"
          style={{ background: "var(--color-purple)" }}
        />
        {[...Array(16)].map((_, index) => (
          <div
            key={index}
            className="absolute h-1 w-1 rounded-full bg-primary animate-float-particle"
            style={{
              top: `${((index * 11) % 90) + 4}%`,
              left: `${((index * 17) % 88) + 6}%`,
              animationDelay: `${index * 0.18}s`,
              opacity: 0.18 + (index % 4) * 0.06,
            }}
          />
        ))}
      </div>

      <div className="relative flex w-full items-center justify-center">
        <div className="relative w-162 z-10 flex items-center justify-between sm:gap-5 lg:gap-7">
          <span className="text-[9.4rem] font-black leading-none tracking-[-0.16em] text-primary/95 sm:text-[12rem] lg:text-[14.4rem]">
            4
          </span>

          <div className="relative border border-red-500 flex h-60 w-60 shrink-0 items-center justify-center rounded-full animate-pulse-glow sm:h-64 sm:w-64">
            <div
              className="absolute animate-spin-ring"
              style={{
                width: "24rem",
                height: "24rem",
                borderRadius: "9999px",
                background:
                  "conic-gradient(from 0deg, transparent, var(--color-main), transparent)",
                padding: "2px",
                maskImage:
                  "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
                WebkitMaskImage:
                  "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
                opacity: 0.35,
              }}
            />

            <div
              className="absolute animate-spin-ring-rev"
              style={{
                width: "20rem",
                height: "20rem",
                borderRadius: "9999px",
                border: "2px dashed var(--color-purple-light)",
                opacity: 0.2,
              }}
            />

            <div
              className="absolute animate-spin-ring-slow"
              style={{
                width: "16rem",
                height: "16rem",
                borderRadius: "9999px",
                background:
                  "linear-gradient(to right, var(--color-main), var(--color-purple))",
                padding: "3px",
                maskImage:
                  "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))",
                WebkitMaskImage:
                  "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))",
                filter: "blur(1px)",
              }}
            />

            <div
              className="relative z-10 flex h-full w-full items-center justify-center rounded-full"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                backdropFilter: "blur(18px)",
                border: "1px solid var(--color-glass-border)",
                boxShadow:
                  "0 0 90px rgba(87, 106, 219, 0.28), inset 0 0 30px rgba(255, 255, 255, 0.05)",
              }}
            >
              <div className="absolute inset-4 rounded-full border border-primary/10" />
              <div className="absolute inset-9 rounded-full border border-primary/8" />
              <div className="absolute inset-13 rounded-full border border-main/18" />

              <img
                src={logo}
                alt="Elchi Logo"
                className="relative z-10 h-24 w-auto object-contain opacity-95 drop-shadow-[0_0_24px_rgba(255,255,255,0.28)] sm:h-28"
                draggable={false}
              />
            </div>
          </div>

          <span className="text-[9.4rem] font-black leading-none tracking-[-0.16em] text-primary/95 sm:text-[12rem] lg:text-[14.4rem]">
            4
          </span>
        </div>
      </div>

      <div className="mt-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.38em] text-primary/45">
          Route Lost In Space
        </p>
        <h1 className="mt-4 text-3xl font-black sm:text-5xl">
          Bu sahifa topilmadi
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-primary/68 sm:text-base">
          Siz kirmoqchi bo&apos;lgan manzil mavjud emas, o&apos;chirilgan yoki noto&apos;g&apos;ri yozilgan
          bo&apos;lishi mumkin. Asosiy sahifaga qayting yoki oldingi sahifaga qaytib ko&apos;ring.
        </p>
      </div>

      <div className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-primary/10 bg-primary/6 p-5 backdrop-blur-xl">
          <Compass className="text-main" size={22} />
          <p className="mt-4 text-xs uppercase tracking-[0.22em] text-primary/45">
            Holat
          </p>
          <p className="mt-2 text-sm font-semibold text-primary/90">
            URL topilmadi
          </p>
        </div>

        <div className="rounded-3xl border border-primary/10 bg-primary/6 p-5 backdrop-blur-xl">
          <SearchX className="text-main" size={22} />
          <p className="mt-4 text-xs uppercase tracking-[0.22em] text-primary/45">
            Kod
          </p>
          <p className="mt-2 text-sm font-semibold text-primary/90">
            404 Not Found
          </p>
        </div>

        <div className="rounded-3xl border border-primary/10 bg-primary/6 p-5 backdrop-blur-xl">
          <House className="text-main" size={22} />
          <p className="mt-4 text-xs uppercase tracking-[0.22em] text-primary/45">
            Tavsiya
          </p>
          <p className="mt-2 text-sm font-semibold text-primary/90">
            Dashboardga qayting
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="error-boundary-button inline-flex min-w-56 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5"
        >
          <House size={17} />
          Asosiy sahifaga qaytish
        </button>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex min-w-56 items-center justify-center gap-2 rounded-2xl border border-primary/10 bg-primary/5 px-6 py-4 text-sm font-semibold text-primary/80 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/10"
        >
          <ArrowLeft size={17} />
          Oldingi sahifaga qaytish
        </button>
      </div>

      <div className="absolute bottom-12 flex gap-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-1.5 w-1.5 rounded-full animate-dot-bounce"
            style={{
              background:
                index === 1 ? "var(--color-main)" : "rgba(255, 255, 255, 0.2)",
              animationDelay: `${index * 0.15}s`,
              boxShadow: index === 1 ? "0 0 10px var(--color-main)" : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(NotFound);
