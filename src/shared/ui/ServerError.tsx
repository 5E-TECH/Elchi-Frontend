import { memo } from "react";
import { useTranslation } from "react-i18next";
import { House, RefreshCw, ServerCrash, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ErrorActions from "./error-page/ErrorActions";
import ErrorCode from "./error-page/ErrorCode";
import ErrorInfoCard from "./error-page/ErrorInfoCard";
import ErrorPageLayout from "./error-page/ErrorPageLayout";

const ServerErrorPage = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  return (
    <ErrorPageLayout>
      <ErrorCode leftDigit="5" rightDigit="0" subtitle={t("serverErrorCodeSubtitle")} />

      <div className="mt-10 text-center">
        <h1 className="text-4xl font-black text-primary sm:text-5xl">
          {t("serverErrorTitle")}
        </h1>
        <p className="error-page-muted mx-auto mt-5 max-w-3xl text-sm leading-7 sm:text-base">
          {t("serverErrorDescription")}
        </p>
      </div>

      <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        <ErrorInfoCard icon={<ServerCrash size={22} />} label={t("state")} value={t("serverUnavailable")} />
        <ErrorInfoCard icon={<ShieldAlert size={22} />} label={t("code")} value={t("serverErrorCode")} />
        <ErrorInfoCard icon={<RefreshCw size={22} />} label={t("recommendation")} value={t("tryAgain")} />
      </div>

      <ErrorActions
        primary={{
          label: t("reload"),
          icon: <RefreshCw size={17} />,
          onClick: () => window.location.reload(),
        }}
        secondary={{
          label: t("returnToHome"),
          icon: <House size={17} />,
          onClick: () => navigate("/"),
        }}
      />
    </ErrorPageLayout>
  );
};

export default memo(ServerErrorPage);
