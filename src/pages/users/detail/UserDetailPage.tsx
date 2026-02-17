import { useParams } from 'react-router-dom';
import { useUser } from '../../../entities/user/api/userApi';
import { UserDetailWidget } from '../../../widgets/user-detail/ui/UserDetailWidget';

export const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { getUserById } = useUser();
  const { data, isLoading, isError, error } = getUserById(id || '');

  return (
    <div className="p-6">
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
