import { memo } from 'react';
import { CreateUserForm } from '../../../features/user/create-user/ui/CreateUserForm';

export const CreateUserWidget = memo(() => {
    return (
        <div className="w-full max-w-5xl mx-auto">
            <CreateUserForm />
        </div>
    );
});
