import { memo } from 'react';
import { CreateUserForm } from '../../../features/user/create-user/ui/CreateUserForm';

export const CreateUserWidget = memo(() => {
    return (
        <div className="mx-auto w-full px-3 pb-3 sm:px-4 sm:pb-4 md:px-5 md:pb-5">
            <CreateUserForm />
        </div>
    );
});
