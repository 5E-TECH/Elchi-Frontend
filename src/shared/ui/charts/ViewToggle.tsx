// dizayn-v2: tizim-charts
import { ChartColumn, List } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SegmentedControl } from "../primitives";

export type ChartView = "chart" | "table";

export interface ViewToggleProps {
  value: ChartView;
  onChange: (value: ChartView) => void;
  /** Guruh nomi (sukut «Ko'rinish»): «Moliyaviy tahlil ko'rinishi». */
  ariaLabel?: string;
  className?: string;
}

/** «GRAFIK | JADVAL» egizagi — har grafikda jadval ko'rinishi (a11y, `tizim-charts`). */
export const ViewToggle = ({ value, onChange, ariaLabel, className }: ViewToggleProps) => {
  const { t } = useTranslation("dashboard");
  return (
    <SegmentedControl<ChartView>
      ariaLabel={ariaLabel ?? t("v2Charts.viewLabel")}
      value={value}
      onValueChange={onChange}
      className={className}
      options={[
        { value: "chart", label: t("v2Charts.viewChart"), icon: ChartColumn },
        { value: "table", label: t("v2Charts.viewTable"), icon: List },
      ]}
    />
  );
};
