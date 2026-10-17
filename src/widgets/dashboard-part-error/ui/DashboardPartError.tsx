// dizayn-v2: tizim-charts, superadmin-dashboard-main
import { memo } from "react";
import { TriangleAlert } from "lucide-react";
import { Card, ErrorState } from "../../../shared/ui/primitives";

export type DashboardPartErrorProps = {
  /** Blok sarlavhasi — karta joyida qoladi («Top marketlar», «Marketlar va kuryerlar» …). */
  title: string;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
  "data-testid"?: string;
};

/**
 * Dashboard bo'lagi olinmadi (VkwhHqvW): backend javobida `degraded` + `failed_parts` — blok 0 lar bilan
 * chizilmaydi, joyida xato holati turadi (taxta `tizim-charts` «Xato»: «Ma'lumotni yuklab bo'lmadi» +
 * «Qayta urinish», ogohlantirish uchburchagi, karta o'z joyida). v1 widget (TopPerformers, PerformanceChart …) o'rniga butun karta
 * sifatida turadi — eski kartaga aralashtirilmaydi (AGENTS.md).
 */
export const DashboardPartError = memo(
  ({ title, onRetry, retrying, className, "data-testid": testId }: DashboardPartErrorProps) => (
    <Card divided={false} title={title} className={className} data-testid={testId} data-part-failed="">
      {/* `status`: bir nechta bo'lak yiqilsa ekran o'quvchi bir xil «alert» larni ketma-ket baqirmaydi. */}
      <ErrorState size="chart" kind="timeout" icon={TriangleAlert} role="status" onRetry={onRetry} retrying={retrying} />
    </Card>
  ),
);
