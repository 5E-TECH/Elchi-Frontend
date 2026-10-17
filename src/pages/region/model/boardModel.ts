/** Viloyat + tumanlar doskasi qidiruvi: viloyat nomi mos kelsa — hamma tumanlari, aks holda mos tumanlar. */
export const filterBoardRegions = <D extends { name: string }, R extends { name: string; districts: D[] }>(
  regions: R[],
  search: string,
): R[] => {
  const term = search.trim().toLocaleLowerCase("uz");
  if (!term) return regions;
  return regions
    .map((region) => ({
      ...region,
      districts: region.name.toLocaleLowerCase("uz").includes(term)
        ? region.districts
        : region.districts.filter((district) => district.name.toLocaleLowerCase("uz").includes(term)),
    }))
    .filter((region) => region.districts.length > 0 || region.name.toLocaleLowerCase("uz").includes(term));
};
