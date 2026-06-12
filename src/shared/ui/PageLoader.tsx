import { memo } from "react";
import { useTranslation } from "react-i18next";
import logo from "../assets/logoo.png";

const PageLoader = () => {
  const { t } = useTranslation("common");

  return (
    <div
      className="page-loader-shell fixed inset-0 z-[9999] flex items-center justify-center"
      role="status"
      aria-label={t("loading")}
    >
      <div className="page-loader-content flex flex-col items-center">
        <div className="page-loader-logo-shell relative flex h-52 w-52 items-center justify-center rounded-[4rem] sm:h-64 sm:w-64 sm:rounded-[5rem]">
          <div className="page-loader-halo absolute inset-0 rounded-[inherit]" />
          <img
            src={logo}
            alt=""
            className="page-loader-logo relative z-10 h-32 w-32 object-contain sm:h-40 sm:w-40"
            draggable={false}
          />
        </div>

        <div className="page-loader-title mt-7 text-center">
          <p className="m-0 text-2xl font-black tracking-[0.14em] text-white sm:text-3xl">
            Elchi Pochta
          </p>
          <div className="page-loader-progress mx-auto mt-5 h-1 w-36 overflow-hidden rounded-full sm:w-44">
            <span className="block h-full w-1/2 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(PageLoader);
