import { memo } from 'react';
import { CreateUserForm } from '../../../features/user/create-user/ui/CreateUserForm';

export const CreateUserWidget = memo(() => {
    return (
        <div className="w-full m-6  mx-auto">
            <CreateUserForm />
        </div>
    );
});
