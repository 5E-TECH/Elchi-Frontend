import { useNavigate, useParams } from 'react-router-dom';
import { User } from 'lucide-react';
import { useUser } from '../../../entities/user/api/userApi';
import { UserDetailWidget } from '../../../widgets/user-detail/ui/UserDetailWidget';
import HeaderName from '../../../shared/components/headerName';

export const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate()
  const { getUserById } = useUser();
  const { data, isLoading, isError, error } = getUserById(id || '');

  return (
    <div className="p-6 bg-sidebar dark:bg-maindark min-h-full rounded-2xl">
      {/* Page Header */}
      <div className="mb-6" onClick={() => navigate(-1)}>
        <HeaderName
          name="Foydalanuvchi Ma'lumotlari"
          description="Batafsil profil va statistika"
          icon={<User />}
        />
      </div>

      {/* Widget */}
      <UserDetailWidget
        user={data?.data}
        isLoading={isLoading}
        isError={isError}
        error={error}
      />
    </div>
  );
};

export default UserDetailPage;
