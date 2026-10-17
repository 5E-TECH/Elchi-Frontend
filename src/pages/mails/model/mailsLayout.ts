/**
 * «Pochta» tab tanasi qayerda chiziladi (dizayn v2, qobiq — `pages/mails/index.tsx`).
 *
 *  - `card` — xodimlar (superadmin, admin, manager, registrator): qobiq bitta `Card padding="none"`
 *    chizadi, ichida tablar va ostida faol tab tanasi. Tananing O'Z kartasi yo'q: asboblar qatori
 *    `px-5 py-4 max-md:px-4`, jadval `border-t border-border`, pastki qism (sahifalash) — tananing o'zida.
 *  - `page` — kuryer: tablar sahifa fonida (karta ustida), tana o'z bo'limlarini chizadi
 *    (`StatCard` lar, `Card`).
 *
 * Har tab tanasi shu kontraktni oladi: `({ layout }: { layout: MailsTabLayout })`.
 */
export type MailsTabLayout = "card" | "page";

export type MailsTabBodyProps = { layout: MailsTabLayout };
