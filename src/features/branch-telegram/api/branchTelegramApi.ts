import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { parseInactiveReason } from "../../../entities/notification";
import type { GroupLinkCode } from "../../telegram-link";
import type { BranchReportTarget, BranchTelegramGroup, BranchTelegramStatus } from "../model/types";

/** Javob konvertda (`{ statusCode, message, data }`) yoki to'g'ridan-to'g'ri kelishi mumkin. */
const unwrap = (body: unknown): Record<string, unknown> => {
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;
  const nested = record.data;
  return nested && typeof nested === "object" && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : record;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : null;

const normalizeGroup = (value: unknown): BranchTelegramGroup | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const chatId = text(row.chat_id);
  if (!chatId) return null;
  return {
    chatId,
    title: text(row.title),
    isActive: row.is_active === true,
    inactiveReason: parseInactiveReason(row.inactive_reason),
    inactiveAt: text(row.inactive_at),
    linkedAt: text(row.linked_at),
  };
};

export const normalizeBranchTelegramStatus = (body: unknown, branchId = ""): BranchTelegramStatus => {
  const data = unwrap(body);
  return {
    branchId: text(data.branch_id) ?? branchId,
    reportTarget: data.report_target === "private" ? "private" : "group",
    group: normalizeGroup(data.group),
    canManage: data.can_manage === true,
  };
};

export const normalizeBranchGroupLinkCode = (body: unknown): GroupLinkCode => {
  const data = unwrap(body);
  const token = text(data.token) ?? "";
  return {
    token,
    purpose: "branch_group",
    group_type: "create",
    expires_at: text(data.expires_at) ?? "",
    deep_link: text(data.deep_link),
    command: text(data.command) ?? (token ? `/start ${token}` : ""),
  };
};

/** GET branches/:id/telegram — guruh holati, hisobot manzili va `can_manage`. */
export const getBranchTelegram = async (branchId: string): Promise<BranchTelegramStatus> => {
  const response = await api.get(API_ENDPOINTS.BRANCHES.TELEGRAM(branchId));
  return normalizeBranchTelegramStatus(response.data, branchId);
};

/** POST branches/:id/telegram/link-code — bir martalik havola (`t.me/<bot>?startgroup=<kod>`, 10 daqiqa). */
export const requestBranchGroupLinkCode = async (branchId: string): Promise<GroupLinkCode> => {
  const response = await api.post(API_ENDPOINTS.BRANCHES.TELEGRAM_LINK_CODE(branchId));
  return normalizeBranchGroupLinkCode(response.data);
};

/** PATCH branches/:id/telegram/report-target — javob: yangilangan holat. */
export const setBranchReportTarget = async ({
  branchId,
  reportTarget,
}: {
  branchId: string;
  reportTarget: BranchReportTarget;
}): Promise<BranchTelegramStatus> => {
  const response = await api.patch(API_ENDPOINTS.BRANCHES.TELEGRAM_REPORT_TARGET(branchId), {
    report_target: reportTarget,
  });
  return normalizeBranchTelegramStatus(response.data, branchId);
};

/** DELETE branches/:id/telegram/group — guruhga hisobot boshqa bormaydi. */
export const unlinkBranchGroup = async (branchId: string): Promise<void> => {
  await api.delete(API_ENDPOINTS.BRANCHES.TELEGRAM_GROUP(branchId));
};
