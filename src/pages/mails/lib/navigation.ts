export const MAIL_TABS = ["today", "return", "refused", "old"] as const;

export type MailTab = (typeof MAIL_TABS)[number];

export const isMailTab = (value: string | null | undefined): value is MailTab =>
  Boolean(value && MAIL_TABS.includes(value as MailTab));

export const normalizeMailTab = (value: string | null | undefined): MailTab =>
  isMailTab(value) ? value : "today";

export const getMailTabPath = (tab: string | null | undefined) =>
  `/mails/${normalizeMailTab(tab)}`;
