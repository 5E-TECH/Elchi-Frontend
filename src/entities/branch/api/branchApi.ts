import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import type { PaginatedResponse } from "../../../shared/types/pagination";
import type {
  Branch,
  BranchParams,
  BranchSetting,
  BranchType,
  Employee,
  SentBatchBranchParams,
  SentBatchBranchRow,
} from "../model/types";

const normalizeBranchType = (value: unknown): BranchType | undefined => {
  const normalized = String(value ?? "").toUpperCase();

  if (normalized === "HQ") return "HQ";
  if (normalized === "CITY") return "CITY";
  if (normalized === "REGIONAL" || normalized === "REGION") return "REGIONAL";
  if (normalized === "DISTRICT") return "DISTRICT";

  return undefined;
};

const normalizeBranch = (value: unknown): Branch => {
  const item = value as Branch & Record<string, any>;
  const parent = item.parent ?? item.parent_branch ?? null;
  const type = item.type ?? item.branch_type;

  return {
    id: String(item.id),
    name: item.name ?? "Noma'lum filial",
    parent_id: item.parent_id ? String(item.parent_id) : parent?.id ? String(parent.id) : "",
    parent: parent
      ? {
          id: String(parent.id ?? ""),
          name: parent.name ?? "—",
        }
      : null,
    type: normalizeBranchType(type),
    level: Number(item.level ?? 0),
    code: item.code ?? "",
    phone_number: item.phone_number ?? item.phone ?? "",
    region: {
      id: String(item.region?.id ?? ""),
      name: item.region?.name ?? "—",
    },
    district: {
      id: String(item.district?.id ?? ""),
      name: item.district?.name ?? "—",
    },
    address: item.address ?? "—",
    status: item.status === "inactive" ? "inactive" : "active",
    employees_count: Number(item.employees_count ?? 0),
    created_at: item.created_at ?? new Date().toISOString(),
  };
};

const normalizeEmployee = (value: unknown): Employee => {
  const item = value as Record<string, any>;
  const user = (item.user ?? item.user_data ?? item.employee ?? {}) as Record<string, any>;

  return {
    id: String(item.id ?? item.user_id ?? user.id ?? ""),
    user: {
      id: String(user.id ?? item.user_id ?? ""),
      fullName:
        user.fullName ??
        user.full_name ??
        user.name ??
        item.fullName ??
        item.full_name ??
        item.name ??
        "Noma'lum",
      phone:
        user.phone ??
        user.phone_number ??
        item.phone ??
        item.phone_number ??
        "—",
    },
    position: item.position ?? item.role ?? user.role ?? "Xodim",
    joined_at: item.joined_at ?? item.created_at ?? item.createdAt ?? new Date().toISOString(),
  };
};

const normalizeSetting = (value: unknown): BranchSetting => {
  const item = value as BranchSetting;
  return {
    id: String(item.id),
    key: item.key ?? "",
    value: item.value ?? "",
  };
};

const normalizeSentBatchBranchRow = (value: unknown): SentBatchBranchRow => {
  const item = value as Record<string, any>;
  const branch = item.branch ?? item.source_branch ?? item.destination_branch ?? item;

  return {
    branch_id: String(branch?.id ?? item.branch_id ?? item.source_branch_id ?? ""),
    name: branch?.name ?? item.branch_name ?? "—",
    phone_number: branch?.phone_number ?? branch?.phone ?? item.phone_number ?? "—",
    batches_count: Number(
      item.sent_batches_count ?? item.batches_count ?? item.batch_count ?? item.count ?? 0,
    ),
    total_price_sum: Number(
      item.sent_total_price ?? item.total_price_sum ?? item.total_price ?? item.sum ?? 0,
    ),
  };
};

const extractArray = <T,>(value: unknown): T[] => {
  const response = value as { data?: T[] | { items?: T[] }; items?: T[] };
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray((response?.data as { items?: T[] } | undefined)?.items)) {
    return (response.data as { items: T[] }).items;
  }
  if (Array.isArray(response?.items)) return response.items;
  return [];
};

const BRANCH_CHILD_KEYS = ["children", "child_branches", "branches"] as const;

const getBranchChildren = (branch: Record<string, any>) => {
  for (const key of BRANCH_CHILD_KEYS) {
    if (Array.isArray(branch[key])) {
      return branch[key] as Record<string, any>[];
    }
  }

  return [];
};

const flattenBranchItems = (
  items: Record<string, any>[],
  parent?: Record<string, any>,
): Record<string, any>[] =>
  items.flatMap((item) => {
    const parentId = parent?.id;
    const parentName = parent?.name;
    const parentLevel = Number(parent?.level ?? 0);
    const branchWithParent =
      parentId && !item.parent_id && !item.parent?.id && !item.parent_branch?.id
        ? {
            ...item,
            parent_id: parentId,
            parent: { id: parentId, name: parentName ?? "—" },
            level: item.level ?? parentLevel + 1,
          }
        : item;
    const children = getBranchChildren(item);

    return [
      branchWithParent,
      ...flattenBranchItems(children, branchWithParent),
    ];
  });

const normalizeBranchList = (value: unknown, params?: BranchParams): PaginatedResponse<Branch> => {
  const response = value as
    | PaginatedResponse<Branch>
    | { data?: Branch[] | { items?: Branch[]; total?: number; page?: number; limit?: number }; total?: number; page?: number; limit?: number };

  const list = flattenBranchItems(extractArray<Record<string, any>>(response));

  return {
    data: list.map(normalizeBranch),
    total: Number(
      response?.total ??
        (response?.data as { total?: number } | undefined)?.total ??
        list.length,
    ),
    page: Number(response?.page ?? (response?.data as { page?: number } | undefined)?.page ?? params?.page ?? 1),
    limit: Number(response?.limit ?? (response?.data as { limit?: number } | undefined)?.limit ?? params?.limit ?? 10),
  };
};

export const getBranches = async (params: BranchParams): Promise<PaginatedResponse<Branch>> => {
  const response = await api.get(API_ENDPOINTS.BRANCHES.BASE, { params });
  return normalizeBranchList(response.data, params);
};

export const getBranchById = async (id: string): Promise<Branch> => {
  const response = await api.get(API_ENDPOINTS.BRANCHES.BY_ID(id));
  return normalizeBranch((response.data as { data?: Branch }).data ?? response.data);
};

export const getBranchEmployees = async (id: string): Promise<Employee[]> => {
  const response = await api.get(API_ENDPOINTS.BRANCHES.USERS(id));
  return extractArray<Employee>(response.data).map(normalizeEmployee);
};

export const getBranchSettings = async (id: string): Promise<BranchSetting[]> => {
  const response = await api.get(API_ENDPOINTS.BRANCHES.SETTINGS(id));
  return extractArray<BranchSetting>(response.data).map(normalizeSetting);
};

export const getBranchesWithSentBatches = async (
  params: SentBatchBranchParams = { side: "source", direction: "FORWARD" },
): Promise<SentBatchBranchRow[]> => {
  const response = await api.get(API_ENDPOINTS.BRANCHES.WITH_SENT_BATCHES, { params });
  const payload = response.data as unknown;
  const payloadObject = payload as Record<string, any>;
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payloadObject?.data?.items)
      ? payloadObject.data.items
      : Array.isArray(payloadObject?.items)
        ? payloadObject.items
        : [];

  return list.map(normalizeSentBatchBranchRow);
};
