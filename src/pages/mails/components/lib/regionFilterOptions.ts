import type { SelectOption } from "../../../../shared/ui/primitives";
import { matchesQuery } from "../../../../shared/ui/primitives/select/selectModel";

/**
 * Qidiruvli «Viloyat» filtri (`Select searchable filter={regionSearchFilter}`, ega qarori 2026-11-09): yozilganda
 * «Barchasi» (`value: ""`) ro'yxatda chiqmaydi — aks holda «a», «b», «s» kabi qisqa so'rovda u birinchi mos variant
 * bo'lib qoladi va Enter filtrni tozalab yuboradi. Hammasiga qaytish — × («Tozalash»). Qolganlari — `Select` sukuti
 * (nom ichida qism, o'zbekcha apostrof turlari bir xil).
 */
export const regionSearchFilter = (option: SelectOption, query: string): boolean =>
  option.value !== "" && matchesQuery(option.label, query);

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
