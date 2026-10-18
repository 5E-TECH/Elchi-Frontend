// dizayn-v2: common-profile, common-profile-password-dialog
import { memo, useState } from "react";
import { Pencil, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUser } from "../../../entities/user/api/userApi";
import { unwrapUserResponse } from "../../../entities/user/lib/normalizeUser";
import { TelegramLinkCard, canLinkTelegram } from "../../../features/telegram-link";
import { MarketTelegramGroupPiiCard } from "../../../widgets/user-detail/ui/MarketTelegramGroupPiiCard";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  QueryBoundary,
  Skeleton,
  SkeletonLines,
} from "../../../shared/ui/primitives";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { EditProfileDialog } from "./EditProfileDialog";
import { hasProfileSalary } from "../lib/profileView";
import { ProfileInfoCard, ProfileSalaryCard, ProfileSecurityCard } from "./ProfileCards";

/**
 * PROFIL (`/profile`, barcha rollar) — maketlar `common-profile`, `common-profile-password-dialog`.
 *
 * Sarlavha «Profil» + asosiy amal «Tahrirlash» (Ism, Telefon — `EditProfileDialog`); ma'lumot kartasi;
 * «Oylik maosh» (faqat maoshli xodimda) va «Xavfsizlik» (parol oynasi) yonma-yon, joy yetmasa ustma-ust.
 * Ostida (maket yo'q — eng yaqini «Xavfsizlik» kartasi) o'z Telegram'ini botga ulash/uzish
 * (`TelegramLinkCard`, faqat xodimlarga — mijoz/investor emas) va marketda «Guruhda mijoz ismi va
 * telefoni» kaliti (`MarketTelegramGroupPiiCard`, market o'zini tahrirlaydi).
 * Ma'lumot — `GET /auth/my-profile` (`useGetMyProfile`), holatlar `QueryBoundary size="page"`.
 *
 * `UpdateUserModal` (`/all-users/:id` ishlatadi) bu sahifada ishlatilmaydi — profil o'z v2 komponentlari bilan
 * chiziladi (spec D7).
 */
/** Yuklanish skeleti — ma'lumot kartasi shaklida (avatar, ism, 4 ta qator). */
const ProfileSkeleton = () => (
  <Card padding="none">
    <div className="flex items-center gap-5 px-5 py-6 max-md:px-4">
      <Skeleton shape="circle" width={64} height={64} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton width="40%" height={16} />
        <Skeleton width="24%" />
      </div>
    </div>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-x-4 gap-y-5 border-t border-border px-5 py-5 max-md:px-4">
      {[0, 1, 2, 3].map((index) => (
        <SkeletonLines key={index} lines={2} />
      ))}
    </div>
  </Card>
);

const ProfilePage = () => {
  const { t } = useTranslation(["profile", "users"]);
  const { useGetMyProfile } = useUser();
  const profileQuery = useGetMyProfile({ silentError: true });
  const user = unwrapUserResponse(profileQuery.data);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("profile:title")}
        description={t("profile:subtitle")}
        actions={
          <Button leftIcon={Pencil} compact disabled={!user} onClick={() => setEditOpen(true)}>
            {t("profile:edit")}
          </Button>
        }
      />

      <QueryBoundary
        query={{ ...profileQuery, data: user ?? null }}
        size="page"
        loading={<ProfileSkeleton />}
        empty={
          <EmptyState
            size="page"
            icon={UserX}
            title={t("users:notFound")}
            description={t("users:userNotFound")}
          />
        }
        className="flex flex-col gap-6 max-md:gap-4"
      >
        {(profile) => (
          <>
            <ProfileInfoCard user={profile} />
            <div className="flex flex-wrap items-stretch gap-6 max-md:gap-4">
              {hasProfileSalary(profile) ? (
                <ProfileSalaryCard user={profile} className="min-w-0 flex-[3_1_460px]" />
              ) : null}
              <ProfileSecurityCard
                onChangePassword={() => setPasswordOpen(true)}
                className="min-w-0 flex-[2_1_320px]"
              />
            </div>
            {canLinkTelegram(profile.role) || profile.role === "market" ? (
              <div className="flex flex-wrap items-stretch gap-6 max-md:gap-4">
                {canLinkTelegram(profile.role) ? (
                  <div className="flex min-w-0 flex-[1_1_320px] flex-col *:flex-1">
                    <TelegramLinkCard
                      linked={profile.telegram_linked === true}
                      username={profile.telegram_username}
                      linkedAt={profile.telegram_linked_at}
                    />
                  </div>
                ) : null}
                {profile.role === "market" ? (
                  <div className="flex min-w-0 flex-[1_1_320px] flex-col *:flex-1">
                    <MarketTelegramGroupPiiCard user={profile} isOwnProfile />
                  </div>
                ) : null}
              </div>
            ) : null}
            <EditProfileDialog open={editOpen} onClose={() => setEditOpen(false)} user={profile} />
            <ChangePasswordDialog
              open={passwordOpen}
              onClose={() => setPasswordOpen(false)}
              name={profile.name}
              phone={profile.phone_number}
            />
          </>
        )}
      </QueryBoundary>
    </div>
  );
};

export default memo(ProfilePage);
