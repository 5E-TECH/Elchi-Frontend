import { useEffect, useRef, useState, type ReactNode } from "react";

interface DeferredMountProps {
  children: ReactNode;
  /** Mount bo'lgunicha joy egallaydi — sahifa sakramasin (CLS). */
  minHeight: number;
  /** Ekranga shuncha yaqinlashganda oldindan mount qilinadi. */
  rootMargin?: string;
  className?: string;
  /**
   * Kuzatish shu `true` bo'lgachgina boshlanadi (sukut `true`). Sahifa hali yuklanayotganda yuqoridagi skeletlar
   * past bo'ladi va pastdagi blok bir lahza ekranga tushib, og'ir chunkni yuklab yuboradi — keyin u baribir
   * pastga suriladi (NIFAnCvf: 1440px da Recharts). Joylashuv barqaror bo'lgach tekshirilsin.
   */
  ready?: boolean;
}

/**
 * EKRANGA KIRGANDA MOUNT (NIFAnCvf). Og'ir widgetlar (Highcharts xaritasi,
 * Recharts grafiklari) sahifa ochilishida emas, foydalanuvchi ularga
 * yaqinlashganda yuklanadi. Ichidagi `lazy` komponent chunki ham shu paytda
 * so'raladi. IntersectionObserver yo'q muhitda (eski brauzer, jsdom) darhol
 * mount qilinadi.
 */
const DeferredMount = ({ children, minHeight, rootMargin = "300px 0px", className, ready = true }: DeferredMountProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (visible || !ready) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ready, rootMargin, visible]);

  return (
    <div ref={ref} className={className} style={visible ? undefined : { minHeight }} data-deferred={visible ? "mounted" : "waiting"}>
      {visible ? children : null}
    </div>
  );
};

export default DeferredMount;
