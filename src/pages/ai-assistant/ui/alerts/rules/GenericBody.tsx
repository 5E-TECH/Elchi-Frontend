// dizayn-v2: (maket yo'q) superadmin-ai-assistant-alert-dialog
import { useTranslation } from "react-i18next";
import {
  ruleConditionText,
  ruleName,
  subjectName,
  type AdvisorTranslate,
  type AiAdvisorAlertDetail,
} from "../../../../../entities/ai-advisor";
import { formatMoneyLocalized } from "../../../../../shared/lib/formatMoney";
import { AlertFacts, SignedMoney } from "../AlertFacts";

/**
 * Umumiy ko'rinish (D14): noma'lum `rule_key` yoki buzilgan `facts` (sarlavha — server `title`) — Joy · Summa
 * (`headline_amount`) · Qoida (ma'lum bo'lsa — ochilgan paytdagi sharti).
 * Dalillar chizilmaydi (noma'lum `evidence.kind` — `null`). Maket yo'q — eng yaqini `superadmin-ai-assistant-alert-dialog`.
 */
export const GenericBody = ({ alert }: { alert: AiAdvisorAlertDetail }) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const tt = t as unknown as AdvisorTranslate;
  return (
    <AlertFacts
      facts={[
        { id: "subject", label: t("alerts.facts.subject"), value: subjectName(alert, tt) },
        alert.headline_amount !== null
          ? {
              id: "amount",
              label: t("alerts.facts.amount"),
              // Kamomad / zarar — ishorali (qizil); qoldiq va qarz — ishorasiz (`+` chalg'itadi).
              value:
                alert.headline_amount < 0 ? (
                  <SignedMoney value={alert.headline_amount} />
                ) : (
                  formatMoneyLocalized(alert.headline_amount, { language })
                ),
            }
          : null,
        {
          id: "rule",
          label: t("alerts.facts.rule"),
          value: ruleConditionText(alert.rule, tt, language) ?? ruleName(alert.rule_key, tt),
        },
      ]}
    />
  );
};
