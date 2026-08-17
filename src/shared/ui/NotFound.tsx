import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Compass, House, SearchX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ErrorActions from "./error-page/ErrorActions";
import ErrorCode from "./error-page/ErrorCode";
import ErrorInfoCard from "./error-page/ErrorInfoCard";
import ErrorPageLayout from "./error-page/ErrorPageLayout";

const NotFoundPage = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  return (
    <ErrorPageLayout>
      <ErrorCode leftDigit="4" rightDigit="4" subtitle={t("notFoundCodeSubtitle")} />

      <div className="mt-10 text-center">
        <h1 className="text-4xl font-black text-primary sm:text-5xl">
          {t("notFoundTitle")}
        </h1>
        <p className="error-page-muted mx-auto mt-5 max-w-3xl text-sm leading-7 sm:text-base">
          {t("notFoundDescription")}
        </p>
      </div>

      <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        <ErrorInfoCard icon={<Compass size={22} />} label={t("state")} value={t("urlNotFound")} />
        <ErrorInfoCard icon={<SearchX size={22} />} label={t("code")} value={t("notFoundCode")} />
        <ErrorInfoCard icon={<House size={22} />} label={t("recommendation")} value={t("returnToDashboard")} />
      </div>

      <ErrorActions
        primary={{
          label: t("returnToHome"),
          icon: <House size={17} />,
          onClick: () => navigate("/"),
        }}
        secondary={{
          label: t("returnToPrevious"),
          icon: <ArrowLeft size={17} />,
          onClick: () => navigate(-1),
        }}
      />
    </ErrorPageLayout>
  );
};

export default memo(NotFoundPage);
