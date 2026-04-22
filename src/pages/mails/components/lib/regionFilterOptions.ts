import type { SearchableSelectOption } from "../../../../shared/ui/SearchableSelect";

interface MailRegionSource {
  region?: {
    id?: string | null;
    name?: string | null;
  } | null;
}

export const buildRegionFilterOptions = <T extends MailRegionSource>(
  items: T[],
  allRegionsLabel: string,
): SearchableSelectOption[] => {
  const uniqueRegions = new Map<string, SearchableSelectOption>();

  items.forEach((item) => {
    const id = item.region?.id;
    const name = item.region?.name;

    if (id && name) {
      uniqueRegions.set(id, { value: id, label: name });
    }
  });

  return [
    { value: "", label: allRegionsLabel },
    ...Array.from(uniqueRegions.values()).sort((left, right) =>
      left.label.localeCompare(right.label, "uz"),
    ),
  ];
};
