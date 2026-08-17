import { Select } from "antd";
import { memo } from "react";
import { useTranslation } from "react-i18next";

export type StatusFilterValue = "active" | "inactive" | "";

interface StatusSelectProps {
  value?: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
  placeholder?: string;
}

const StatusSelect = ({ value = "", onChange, placeholder }: StatusSelectProps) => {
  const { t } = useTranslation("common");
  const options = [
    { value: "", label: t("all") },
    { value: "active", label: t("active") },
    { value: "inactive", label: t("inactive") },
  ];

  return (
    <Select
      value={value}
      options={options}
      placeholder={placeholder ?? t("status")}
      style={{ minWidth: 160 }}
      onChange={(nextValue) => onChange(nextValue as StatusFilterValue)}
    />
  );
};

export default memo(StatusSelect);
