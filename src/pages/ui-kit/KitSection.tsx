import type { ComponentProps, ReactNode } from "react";
import { cx } from "../../shared/lib/cx";

export type KitSectionProps = Omit<ComponentProps<"section">, "title" | "id"> & {
  /** Bo'lim kaliti: langar (`#buttons`) va `?section=buttons` filtri shu bilan. */
  id: string;
  title: ReactNode;
  description?: ReactNode;
};

/**
 * Komponentlar to'plami sahifasidagi bitta bo'lim: langar, `h2` sarlavha,
 * qisqa izoh va namunalar. Tipografiya — DESIGN_SYSTEM §4 (bo'lim 16/24 · 700).
 */
export const KitSection = ({ id, title, description, className, children, ...rest }: KitSectionProps) => {
  const titleId = `kit-${id}-title`;
  return (
    <section
      id={id}
      data-kit-section={id}
      aria-labelledby={titleId}
      className={cx("flex min-w-0 scroll-mt-6 flex-col gap-4", className)}
      {...rest}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={titleId} className="text-base font-bold text-text">
          {title}
        </h2>
        {description ? <p className="text-sm text-text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
};
