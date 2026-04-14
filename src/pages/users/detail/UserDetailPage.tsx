import { useNavigate, useParams } from 'react-router-dom';
import { User } from 'lucide-react';
import { useUser } from '../../../entities/user/api/userApi';
import { UserDetailWidget } from '../../../widgets/user-detail/ui/UserDetailWidget';
import HeaderName from '../../../shared/components/headerName';
import { useTranslation } from 'react-i18next';
import type { User as UserType } from '../../../entities/user/types/user';

export const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("users");
  const navigate = useNavigate()
  const { getUserById } = useUser();
  const { data, isLoading, isError, error } = getUserById(id || '');
  const user: UserType | undefined = (() => {
    const payload = data as
      | UserType
      | { data?: UserType | { data?: UserType } }
      | undefined;

    if (!payload) return undefined;
    if ("data" in payload && payload.data) {
      if (typeof payload.data === "object" && payload.data && "data" in payload.data && payload.data.data) {
        return payload.data.data;
      }
      return payload.data as UserType;
    }

    return payload as UserType;
  })();

  return (
    <div className="p-6 bg-sidebar dark:bg-maindark min-h-full rounded-2xl">
      {/* Page Header */}
      <div className="mb-6" onClick={() => navigate(-1)}>
        <HeaderName
          name={t("userDetailsTitle")}
          description={t("userDetailsDescription")}
          icon={<User />}
        />
      </div>

      {/* Widget */}
      <UserDetailWidget
        user={user}
        isLoading={isLoading}
        isError={isError}
        error={error}
      />
    </div>
  );
};

export default UserDetailPage;
