import { describe, expect, it } from "vitest";
import type { Branch } from "../../../entities/branch";
import { filterParentCandidates } from "../../branch/lib/branchFormOptions";
import { buildCreateBranchPayload } from "./payload";
import { branchSchema } from "./schema";
import type { CreateBranchDto } from "./types";

const base: CreateBranchDto = {
  name: "Toshkent PICKUP",
  parent_id: "1",
  type: "PICKUP",
  code: " pck-tsh ",
  phone_number: "+998903009040",
  region_id: "1",
  district_id: "11",
  address: "Toshkent",
};

describe("buildCreateBranchPayload — PICKUP filial ekrandan yaratiladi", () => {
  it("⭐ PICKUP uchun tanlangan yuqori filial yuboriladi (ilgari '' bilan almashtirilardi → 400)", () => {
    const payload = buildCreateBranchPayload(base);
    expect(payload.parent_id).toBe("1");
    expect(payload.type).toBe("PICKUP");
  });

  it("HYBRID ostidagi PICKUP — yuqori filial HYBRID id'si bo'ladi", () => {
    expect(buildCreateBranchPayload({ ...base, parent_id: "17" }).parent_id).toBe("17");
  });

  it("REGIONAL/HYBRID xatti-harakati o'zgarmaydi: tur katta harfda, kod trim qilinadi", () => {
    const payload = buildCreateBranchPayload({ ...base, type: "regional" as CreateBranchDto["type"], parent_id: " 1 " });
    expect(payload).toMatchObject({ type: "REGIONAL", code: "pck-tsh", parent_id: "1" });
  });
});

describe("branchSchema — yuqori filial har bir tur uchun majburiy", () => {
  it("⭐ yuqori filialsiz PICKUP o'tmaydi", async () => {
    await expect(branchSchema.validate({ ...base, parent_id: "" })).rejects.toThrow();
  });

  it("yuqori filialli PICKUP o'tadi", async () => {
    await expect(branchSchema.validate(base)).resolves.toMatchObject({ type: "PICKUP", parent_id: "1" });
  });

  it("yuqori filialsiz REGIONAL ham o'tmaydi (avvalgidek)", async () => {
    await expect(branchSchema.validate({ ...base, type: "REGIONAL", parent_id: "" })).rejects.toThrow();
  });
});

describe("filterParentCandidates — PICKUP yuqori filial bo'la olmaydi", () => {
  const branch = (id: string, type: string) => ({ id, name: `F${id}`, type } as unknown as Branch);

  it("PICKUP'lar chiqariladi, HQ/REGIONAL/HYBRID qoladi", () => {
    const result = filterParentCandidates([branch("1", "HQ"), branch("16", "REGIONAL"), branch("17", "HYBRID"), branch("18", "PICKUP")]);
    expect(result.map((b) => b.id)).toEqual(["1", "16", "17"]);
  });

  it("kichik harfli tur va bo'sh ro'yxat", () => {
    expect(filterParentCandidates([branch("19", "pickup"), branch("1", "HQ")]).map((b) => b.id)).toEqual(["1"]);
    expect(filterParentCandidates(undefined)).toEqual([]);
  });
});
