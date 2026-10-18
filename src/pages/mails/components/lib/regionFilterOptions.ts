import type { SelectOption } from "../../../../shared/ui/primitives";

interface MailRegionSource {
  region?: {
    id?: string | null;
    name?: string | null;
  } | null;
}

/**
 * Ro'yxatdagi pochtalar viloyatlari → filtr variantlari (takrorsiz, nom bo'yicha o'zbekcha tartibda).
 * Variant shakli `{ value, label }` — v2 `Select` ham, v1 `SearchableSelect` ham shuni oladi.
 */
export const buildRegionFilterOptions = <T extends MailRegionSource>(items: readonly T[]): SelectOption[] => {
  const uniqueRegions = new Map<string, SelectOption>();

  items.forEach((item) => {
    const id = item.region?.id;
    const name = item.region?.name;

    if (id && name) {
      uniqueRegions.set(id, { value: id, label: name });
    }
  });

  return Array.from(uniqueRegions.values()).sort((left, right) => left.label.localeCompare(right.label, "uz"));
};
