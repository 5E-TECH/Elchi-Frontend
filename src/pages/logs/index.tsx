// dizayn-v2: superadmin-ops-auth-diagnostics
import { memo, useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { refreshAccessToken } from "../../auth/authService";
import { Badge, Button, Card } from "../../shared/ui/primitives";
import { OpsAlert, OpsIntro, OpsToolPage } from "../ops/ui/OpsToolPage";

/**
 * OPS → «Kirish diagnostikasi» (maket `superadmin-ops-auth-diagnostics`; eski yo'l `/logs`).
 *
 * ⚠️ NOMI O'ZGARTIRILGAN. Ilgari menyuda «Loglar» deb turardi — lekin bu sahifa jurnal KO'RSATMAYDI, u
 * `POST /auth/refresh` ga sinov so'rovi yuboradi (`refreshAccessToken()`). Haqiqiy jurnal — `/activity-logs`
 * (kirish kartasidagi havola).
 */

type RequestState =
  | { kind: "idle" }
  | { kind: "success"; token: string }
  | { kind: "error" };

/** Token boshidan shuncha belgi ko'rsatiladi (qolgani yashirin). */
const TOKEN_PREVIEW = 16;

const AuthDiagnosticsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { t } = useTranslation("ops");
  const [state, setState] = useState<RequestState>({ kind: "idle" });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setState({ kind: "idle" });
    try {
      const accessToken = await refreshAccessToken();
      setState({ kind: "success", token: accessToken.slice(0, TOKEN_PREVIEW) });
    } catch {
      setState({ kind: "error" });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <OpsToolPage tabKey="auth" embedded={embedded}>
      <OpsIntro
        title={t("auth.intro.title")}
        description={
          <>
            {t("auth.intro.description")}
            <span className="max-md:hidden">
              {" "}
              {t("auth.intro.journalPrefix")}{" "}
              <Link to="/activity-logs" className="whitespace-nowrap font-semibold text-action-fg hover:text-action-hover">
                {t("auth.intro.journalLink")}
              </Link>
            </span>
            <Link
              to="/activity-logs"
              className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-semibold text-action-fg md:hidden"
            >
              {t("auth.intro.journalMobile")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </>
        }
      />

      <Card title={t("auth.test.title")} description={t("auth.test.description")} bodyClassName="flex flex-col gap-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-xl bg-sunken px-5 py-4 max-md:px-4">
          <div className="flex min-w-0 flex-[999_1_240px] flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{t("auth.test.endpoint")}</span>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">POST</Badge>
              <span className="font-semibold text-text wrap-anywhere">/auth/refresh</span>
            </div>
          </div>
          <Button
            leftIcon={Send}
            loading={isRefreshing}
            loadingText={t("auth.test.submitting")}
            onClick={() => void handleRefresh()}
            className="flex-[1_0_auto]"
          >
            {t("auth.test.submit")}
          </Button>
        </div>

        {state.kind !== "idle" ? (
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{t("auth.test.result")}</span>
            {state.kind === "success" ? (
              <OpsAlert tone="success" title={t("auth.test.success")}>
                {t("auth.test.successDetail", { token: state.token })}
              </OpsAlert>
            ) : (
              <OpsAlert tone="danger" title={t("auth.test.error")}>
                {t("auth.test.errorDetail")}
              </OpsAlert>
            )}
          </div>
        ) : null}
      </Card>
    </OpsToolPage>
  );
};

export default memo(AuthDiagnosticsPage);
