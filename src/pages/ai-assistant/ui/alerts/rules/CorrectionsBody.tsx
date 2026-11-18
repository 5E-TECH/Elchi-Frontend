// dizayn-v2: superadmin-ai-assistant-alert-dialog-corrections
import { useId } from "react";
import { formatAdvisorDayRange } from "../../../../../entities/ai-advisor";
import { Meter } from "../../../../../shared/ui/charts";
import { AlertFacts } from "../AlertFacts";
import { countedCorrectionKinds } from "./ruleData";
import { useRuleFormat } from "./ruleKit";
import type { RuleBodyProps } from "./types";

/**
 * R8 «Tuzatishlar ko'paydi» (maket `superadmin-ai-assistant-alert-dialog-corrections`): faktlar — Hafta, Tuzatishlar
 * («14 ta · 9 qaytarish, 5 tahrir» — sanalgan turlar), «30 kunlik o'rtacha» («6,1 ta / hafta»), Nisbat, Qoida;
 * «Taqsimot · N ta tuzatish» — «Turi bo'yicha» ingichka o'lchagichlar (`by_kind`, faqat `counted_kinds`). Shartnomada
 * yo'q (v0.4): «Tuzatilgan to'lovlar jami», «Kassa bo'yicha», «Kim tuzatgan», «Eng katta tuzatishlar».
 */
export const CorrectionsBody = ({ alert }: RuleBodyProps<"R8">) => {
  const f = useRuleFormat();
  const { t } = f;
  const titleId = useId();
  const kindsId = useId();
  const facts = alert.facts;
  const evidence = alert.evidence?.kind === "corrections" ? alert.evidence : null;
  const kinds = countedCorrectionKinds(evidence);
  const range = formatAdvisorDayRange(facts.from, facts.to);
  const parts = kinds.map(({ kind, count }) => t(`alerts.correctionKinds.short.${kind}`, { count }));
  const total = Math.max(facts.count, kinds.reduce((sum, item) => sum + item.count, 0));

  return (
    <>
      <AlertFacts
        facts={[
          { id: "week", label: t("alerts.facts.week"), value: range },
          {
            id: "corrections",
            label: t("alerts.facts.corrections"),
            value: parts.length ? `${f.items(facts.count)} · ${parts.join(", ")}` : f.items(facts.count),
          },
          {
            id: "baseline",
            label: t("alerts.facts.baseline", { count: evidence?.baseline.window_days ?? 30 }),
            value: t("alerts.facts.baselineValue", { value: f.ratio(facts.baseline_weekly_avg) }),
          },
          {
            id: "ratio",
            label: t("alerts.facts.ratio"),
            // Baza 0 — nisbat yo'q (`ratio: null`): «Oldingi 30 kunda tuzatish bo'lmagan», qator tashlanmaydi.
            value:
              facts.ratio === null
                ? t("alerts.facts.ratioNoBaseline", { count: evidence?.baseline.window_days ?? 30 })
                : t("alerts.facts.ratioValue", { value: f.ratio(facts.ratio) }),
          },
          { id: "rule", label: t("alerts.facts.rule"), value: f.condition(alert) },
        ]}
      />
      {kinds.length ? (
        <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 id={titleId} className="m-0 text-sm font-semibold text-text">
              {t("alerts.evidence.corrections.title", { corrections: t("alerts.units.corrections", { count: facts.count }) })}
            </h3>
            <span className="text-xs text-text-muted">{range}</span>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-2.5">
              <h4 id={kindsId} className="m-0 text-xs font-semibold tracking-[.05em] text-text-muted uppercase">
                {t("alerts.evidence.corrections.byKind")}
              </h4>
              <ul aria-labelledby={kindsId} className="m-0 flex list-none flex-col gap-2.5 p-0">
                {kinds.map(({ kind, count }) => {
                  const name = t(`alerts.correctionKinds.name.${kind}`);
                  return (
                    <li key={kind} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 text-[13px] text-text">{name}</span>
                        <span className="text-[13px] font-semibold whitespace-nowrap text-text">{f.items(count)}</span>
                      </div>
                      <Meter
                        value={count}
                        max={total}
                        thickness="thin"
                        ariaLabel={t("alerts.evidence.corrections.meter", {
                          name,
                          total: f.count(total),
                          value: f.count(count),
                        })}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
};
