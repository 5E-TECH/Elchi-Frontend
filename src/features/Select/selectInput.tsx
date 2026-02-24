import { memo, type ChangeEvent } from 'react';
// import { useDispatch } from 'react-redux';

interface Option {
  value: string;
  label: string;
}

interface SelectInputProps {
  label?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  error?: string | null;
}

const SelectInput = memo(({
  label,
  value,
  onChange,
  options,
  placeholder = "Tanlang...",
  disabled = false,
  error = null
}: SelectInputProps) => {
  // const dispatch = useDispatch()

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-semibold text-gray-700">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`
          px-4 py-3 border rounded-xl text-base
          transition duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${disabled
            ? 'bg-gray-100 cursor-not-allowed text-gray-500 border-gray-300'
            : 'bg-white dark:bg-maindark dark:text-primary dark:border-primarydark/50 border-gray-300 hover:border-gray-400'
          }
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
        `}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
});

SelectInput.displayName = 'SelectInput';

export default SelectInput;