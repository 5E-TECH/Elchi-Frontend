/**
 * Ops markazining tab ma'lumotlari — JSX'siz, sof ma'lumot.
 *
 * Alohida fayl, chunki testlar shu ro'yxatni React komponentini (va uning
 * lazy importlarini) tortmasdan o'qiy olishi kerak.
 */
export interface OpsTabMeta {
  key: string;
  label: string;
  /**
   * Markaz qo'shilgunga qadar mavjud bo'lgan to'g'ridan-to'g'ri marshrut.
   * SAQLANADI — eski havola yoki xatcho'p buzilmasin.
   */
  legacyPath: string;
  /** `src/pages/` ichidagi papka nomi. */
  pageDir: string;
}

export const OPS_TABS: OpsTabMeta[] = [
  {
    key: "finance",
    label: "Moliya operatorlari",
    legacyPath: "/finance-operators",
    pageDir: "finance-operators",
  },
  {
    key: "integrations",
    label: "Integratsiyalar",
    legacyPath: "/integrations-ops",
    pageDir: "integrations-ops",
  },
  {
    key: "investors",
    label: "Investorlar",
    legacyPath: "/investors-ops",
    pageDir: "investors-ops",
  },
  {
    key: "logistics",
    label: "Logistika",
    legacyPath: "/logistics-ops",
    pageDir: "logistics-ops",
  },
  {
    key: "branches",
    label: "Filiallar",
    legacyPath: "/branch-ops",
    pageDir: "branch-ops",
  },
  {
    key: "identity",
    label: "Xodimlar",
    legacyPath: "/identity-ops",
    pageDir: "identity-ops",
  },
  {
    key: "system",
    label: "Tizim",
    legacyPath: "/system-ops",
    pageDir: "system-ops",
  },
];
