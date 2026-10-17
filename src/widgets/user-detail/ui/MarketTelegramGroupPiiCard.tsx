// dizayn-v2: superadmin-users-detail, admin-users-detail
import { memo, useId, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../app/config/store";
import { useUser } from "../../../entities/user/api/userApi";
import type { User } from "../../../entities/user/types/user";
import { getActionErrorMessage } from "../../../shared/lib/actionError";
import { notify } from "../../../shared/lib/notify";
import { Card } from "../../../shared/ui/primitives";

interface MarketTelegramGroupPiiCardProps {
  user: User;
  /** `/profile` — market o'z profilini ko'rmoqda. */
  isOwnProfile?: boolean;
}

/**
 * «Guruhda mijoz ismi va telefoni» kaliti (ysBqD9Nx) — market Telegram GURUHIDAGI buyurtma kartalarida
 * mijoz ismi/telefoni ko'rinadimi (`tg_group_show_customer_pii`, backend sukuti `true`; `false` — ism
 * yashirin, telefon niqoblangan). `PATCH markets/:id/telegram-group-pii`.
 *
 * Ko'rinishi — maketdagi «Ruxsatlar» kartasining kalit qatori (`superadmin-users-detail` /
 * `admin-users-detail`: `.el-card` + `.el-card-head` «O'zgarish darhol saqlanadi» + `label` qatori
 * `.el-h3` / `.el-small.el-muted` / `.el-switch`). Kalitning o'zi maketda yo'q (Trello kartasidagi ega
 * qarori). Hozirgi sahifada «Ruxsatlar» alohida karta emas — market ruxsatlari eski (v1) «Profil
 * ma'lumotlari» kartasi ichida; o'sha butun karta (barcha rollar, o'z profili) bu ish doirasidan katta,
 * shuning uchun kalit AGENTS.md bo'yicha o'zining alohida v2 kartasida, eski karta yonida turadi.
 *
 * Darhol qaytariladigan ruxsat kaliti — tasdiq oynasisiz (DESIGN_SYSTEM §8): bosilganda holat darhol
 * o'zgaradi → PATCH → foydalanuvchi so'rovi yangilanadi → `notify.success`; xato bo'lsa kalit qaytadi va
 * backend matni `notify.error` da.
 *
 * O'zgartira oladi: superadmin, admin — istalgan market; market — faqat o'zi (backend boshqasiga 403).
 * Qolganlar (menejer, registrator) holatni ko'radi, kalit nofaol.
 */
export const MarketTelegramGroupPiiCard = memo(
  ({ user, isOwnProfile = false }: MarketTelegramGroupPiiCardProps) => {
    const { t } = useTranslation("users");
    const viewer = useSelector((state: RootState) => state.role);
    const { updateMarketTelegramGroupPii } = useUser();
    const labelId = useId();
    const hintId = useId();

    const canEdit =
      viewer.role === "superadmin" ||
      viewer.role === "admin" ||
      (viewer.role === "market" && (isOwnProfile || String(viewer.id ?? "") === String(user.id)));

    // Backend sukuti `true`: maydon kelmasa (eski javob) ham yoqiq deb ko'rsatiladi.
    const serverValue = user.tg_group_show_customer_pii !== false;
    // Bosilgan qiymat server yangi qiymatni qaytarguncha ko'rinadi: `basis` — bosilgan paytdagi server
    // qiymati; so'rov yangilangach (server qiymati o'zgarsa) bu qatlam o'z-o'zidan e'tiborsiz qoladi.
    const [pending, setPending] = useState<{ value: boolean; basis: boolean } | null>(null);
    const checked = pending && pending.basis === serverValue ? pending.value : serverValue;
    const isSaving = updateMarketTelegramGroupPii.isPending;

    const handleToggle = async () => {
      if (!canEdit || isSaving) return;
      const next = !checked;
      setPending({ value: next, basis: serverValue });

      try {
        await updateMarketTelegramGroupPii.mutateAsync({
          id: String(user.id),
          tg_group_show_customer_pii: next,
        });
        notify.success(t("tgGroupPiiSaved"), {
          description: next ? t("tgGroupPiiShownDescription") : t("tgGroupPiiHiddenDescription"),
        });
      } catch (error) {
        setPending(null);
        // `null` — javob umuman kelmadi: tarmoq xatosini global xabar allaqachon ko'rsatgan.
        const message = getActionErrorMessage(error, t("tgGroupPiiSaveErrorDescription"));
        if (message !== null) notify.error(t("tgGroupPiiSaveError"), { description: message });
      }
    };

    return (
      <Card
        title={t("tgGroupCardTitle")}
        actions={<span className="text-[13px] text-text-muted">{t("changesSaveInstantly")}</span>}
        padding="none"
        data-testid="market-tg-group-pii-card"
      >
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          aria-describedby={hintId}
          aria-busy={isSaving || undefined}
          disabled={!canEdit}
          onClick={() => void handleToggle()}
          className="group flex min-h-11 w-full items-center justify-between gap-4 rounded-b-[14px] px-5 py-3.5 text-left transition-colors duration-150 not-disabled:hover:bg-row-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed motion-reduce:transition-none"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span id={labelId} className="text-sm font-semibold text-text">
              {t("tgGroupPiiLabel")}
            </span>
            <span id={hintId} className="text-[13px] text-text-muted">
              {t("tgGroupPiiHint")}
            </span>
          </span>
          <span
            aria-hidden="true"
            className="relative h-5 w-9 flex-none rounded-full bg-border-strong transition-colors duration-150 group-aria-checked:bg-action group-disabled:opacity-45 motion-reduce:transition-none"
          >
            <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 group-aria-checked:translate-x-4 motion-reduce:transition-none" />
          </span>
        </button>
      </Card>
    );
  },
);

MarketTelegramGroupPiiCard.displayName = "MarketTelegramGroupPiiCard";
