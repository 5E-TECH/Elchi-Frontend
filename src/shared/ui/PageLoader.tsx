import { memo } from "react";
import { useTranslation } from "react-i18next";
import LogoWhite from "../assets/brand/elchi-logo-white.png";

/**
 * ILOVA OCHILAYOTGANDA — to'liq ekran (dizayn v2, taxta `tizim-loading` 01 «2 · Faqat ilova ochilganda»).
 *
 * Faqat sayt birinchi marta ochilganda yoki brauzerda yangilanganda, kirish tekshirilguncha (ko'pi bilan
 * 15 s). Bo'limlar orasida o'tishda hech qachon ko'rsatilmaydi (u yerda shell'dagi yuqori chiziq).
 * Navy fon (`nav`), oq logotip, ingichka chiziq va «Yuklanmoqda…»; «Harakatni kamaytirish» da chiziq to'xtaydi.
 */
const PageLoader = () => {
  const { t } = useTranslation("ui");

  return (
    <div
      role="status"
      aria-label={t("states.appLoading")}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-nav p-6"
    >
      <img src={LogoWhite} alt="Elchi Pochta" width={145} height={48} className="block h-12 w-auto" draggable={false} />
      <div className="flex flex-col items-center gap-3">
        <div aria-hidden="true" className="h-1 w-40 overflow-hidden rounded-full bg-nav-active">
          <span className="block h-full w-2/5 rounded-full bg-nav-text animate-[pageLoaderProgress_1.35s_ease-in-out_infinite] motion-reduce:animate-none" />
        </div>
        <span className="text-[13px] text-nav-muted">{t("common.loading")}</span>
      </div>
    </div>
  );
};

export default memo(PageLoader);
