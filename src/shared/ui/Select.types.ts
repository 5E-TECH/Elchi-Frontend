import type { ChangeEvent } from "react";

export interface SelectOption {
    value: string;
    label: string;
}

export interface SelectProps {
    label?: string;
    name: string;
    value?: string;
    onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
    options: SelectOption[];
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    loading?: boolean;
    required?: boolean;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    className?: string;

    // Redux integratsiyasi uchun
    useRedux?: boolean; // true bo'lsa Redux ishlatadi
    reduxKey?: string; // Redux da qaysi key ostida saqlash (masalan: 'userRole', 'region')
}
