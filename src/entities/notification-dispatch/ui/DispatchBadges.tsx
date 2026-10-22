// dizayn-v2: superadmin-notifications-send-result, superadmin-notifications-sent-detail-dialog
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../../shared/ui/primitives";
import { DISPATCH_STATUS_META, failureBadge, type DispatchOutcome } from "../model/status";

/** Natija belgisi: «Yuborildi» · «Qisman yuborildi» · «Faqat ilova ichida» · «Yuborilmoqda» · «Xato» · «Noma'lum». */
export const DispatchStatusBadge = ({ status }: { status: DispatchOutcome }) => {
  const { t } = useTranslation("notifications");
  const meta = DISPATCH_STATUS_META[status];
  return <StatusBadge tone={meta.tone} icon={meta.icon} label={t(meta.labelKey)} />;
};

/** «Yetkazilmaganlar» dagi bitta kanal belgisi: «Xato» (qizil) · «O'tkazib yuborildi» / «Provayder ulanmagan» (kulrang). */
export const FailureBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation("notifications");
  const meta = failureBadge(status);
  return <StatusBadge tone={meta.tone} icon={meta.icon} label={t(meta.labelKey)} />;
};
