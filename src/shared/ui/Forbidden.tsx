import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EmptyState from "./EmptyState";

const ForbiddenPage = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 dark:bg-background">
      <EmptyState
        icon={<LockKeyhole size={30} />}
        title={t("forbiddenTitle")}
        description={t("forbiddenDescription")}
        className="w-full max-w-xl border-white/10 bg-primary/95 py-16 dark:bg-maindark"
        action={(
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-2xl bg-main px-5 py-3 text-sm font-bold text-white shadow-lg shadow-main/25 transition hover:bg-main/90"
          >
            <ArrowLeft size={16} />
            {t("goBack")}
          </button>
        )}
      />
    </main>
  );
};

export default memo(ForbiddenPage);
