export type RegionScope = {
  id: string;
  name: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const getText = (...values: unknown[]) => {
  const value = values.find(
    (item) =>
      (typeof item === "string" && item.trim().length > 0) ||
      (typeof item === "number" && Number.isFinite(item)),
  );
  return value == null ? "" : String(value).trim();
};

export const resolveRegionScope = (value: unknown): RegionScope => {
  const user = asRecord(value);
  const region = asRecord(user.region);
  const assignedRegion = asRecord(user.assigned_region ?? user.assignedRegion);
  const courier = asRecord(user.courier);
  const courierRegion = asRecord(courier.region);
  const district = asRecord(user.district);
  const districtRegion = asRecord(district.region);
  const branch = asRecord(user.branch);
  const branchRegion = asRecord(branch.region);
  const nestedBranch = asRecord(branch.branch);
  const nestedBranchRegion = asRecord(nestedBranch.region);
  const regions = Array.isArray(user.regions) ? user.regions : [];
  const firstRegion = asRecord(regions[0]);

  return {
    id: getText(
      user.region_id,
      user.regionId,
      user.assigned_region_id,
      user.assignedRegionId,
      region.id,
      assignedRegion.id,
      courier.region_id,
      courier.regionId,
      courierRegion.id,
      district.region_id,
      district.regionId,
      districtRegion.id,
      branch.region_id,
      branch.regionId,
      branchRegion.id,
      nestedBranch.region_id,
      nestedBranch.regionId,
      nestedBranchRegion.id,
      firstRegion.id,
    ),
    name: getText(
      user.region_name,
      user.regionName,
      region.name,
      assignedRegion.name,
      courier.region_name,
      courier.regionName,
      courierRegion.name,
      district.region_name,
      district.regionName,
      districtRegion.name,
      branch.region_name,
      branch.regionName,
      branchRegion.name,
      nestedBranch.region_name,
      nestedBranch.regionName,
      nestedBranchRegion.name,
      firstRegion.name,
    ),
  };
};

const unwrapData = (value: unknown) => {
  const root = asRecord(value);
  const first = root.data ?? value;
  const firstRecord = asRecord(first);
  return firstRecord.data ?? first;
};

const findCollection = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  const candidates = [
    record.items,
    record.couriers,
    record.users,
    record.results,
    record.data,
  ];
  return (candidates.find(Array.isArray) as unknown[] | undefined) ?? [];
};

export const findOrderRegionScope = (payload: unknown): RegionScope => {
  const orders = findCollection(unwrapData(payload)).map(asRecord);

  for (const order of orders) {
    const scope = resolveRegionScope(order);
    if (scope.id || scope.name) return scope;
  }

  return { id: "", name: "" };
};
