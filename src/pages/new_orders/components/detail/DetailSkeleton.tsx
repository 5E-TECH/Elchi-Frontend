// dizayn-v2: superadmin-orders-detail, courier-orders-detail
import { Card, Skeleton, SkeletonLines } from "../../../../shared/ui/primitives";

/** Yuklanish skeleti — ikki ustunli tafsilot shaklida (yon ustun: 2 karta, asosiy: mahsulotlar). */
const SkeletonCard = ({ lines }: { lines: number }) => (
  <Card title={<Skeleton width={120} height={16} />}>
    <SkeletonLines lines={lines} />
  </Card>
);

export const DetailSkeleton = () => (
  <div className="flex flex-row-reverse flex-wrap gap-6 max-md:gap-4">
    <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-6 max-md:gap-4">
      <SkeletonCard lines={3} />
      <SkeletonCard lines={3} />
    </div>
    <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-6 max-md:gap-4">
      <SkeletonCard lines={5} />
      <SkeletonCard lines={4} />
    </div>
  </div>
);
