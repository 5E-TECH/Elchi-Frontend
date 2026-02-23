import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CreateUserWidget } from '../../../widgets/user-create/ui/CreateUserWidget';
import HeaderName from '../../../shared/components/headerName';

const CreateUserPage = memo(() => {
    const navigate = useNavigate();

    return (
        <div className="bg-sidebar rounded-2xl dark:bg-maindark">
            <div className='' onClick={() => navigate(-1)}>
                <HeaderName name='Yangi Foydalanuvchi ' icon={<ArrowLeft/>} description='Yangi foydalanuvchi kiritish' />
            </div>

            <CreateUserWidget />
        </div>
    );
});

export default CreateUserPage;
