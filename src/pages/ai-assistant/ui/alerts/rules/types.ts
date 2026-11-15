import type { AiAdvisorAlertDetail, AiAdvisorFactsByRule, AiAdvisorRuleKey } from "../../../../../entities/ai-advisor";

/** Ma'lum qoidaning tafsiloti (`rule_key` va `facts` toraytirilgan). */
export type KnownAlertDetail<R extends AiAdvisorRuleKey> = AiAdvisorAlertDetail & { rule_key: R; facts: AiAdvisorFactsByRule[R] };

export type RuleBodyProps<R extends AiAdvisorRuleKey> = { alert: KnownAlertDetail<R> };
