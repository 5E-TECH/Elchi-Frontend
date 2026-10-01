import { describe, expect, it } from "vitest";
import { ValidationError } from "yup";
import i18n from "../../../i18n";
import { branchEditSchema, type BranchEditSchemaContext } from "./schema";

const baseValues = {
  name: "Bosh ofis",
  parent_id: "",
  code: "HQ",
  phone_number: "+998901234567",
  address: "Toshkent sh., Chilonzor 1",
};

/** `path -> xabarlar` (abortEarly: false — RHF resolver ham shunday tekshiradi). */
const validationErrors = async (
  values: Record<string, unknown>,
  context?: BranchEditSchemaContext,
): Promise<Record<string, string[]>> => {
  try {
    await branchEditSchema.validate(values, { abortEarly: false, context });
    return {};
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return error.inner.reduce<Record<string, string[]>>((acc, item) => {
      const path = item.path ?? "";
      acc[path] = [...(acc[path] ?? []), item.message];
      return acc;
    }, {});
  }
};

describe("branchEditSchema — HQ (bosh ofis) filiali", () => {
  it("accepts type HQ without a parent when the edited branch is HQ", async () => {
    expect(await validationErrors({ ...baseValues, type: "HQ" }, { isHqBranch: true })).toEqual({});
  });

  it("still validates the other HQ fields (name, code, phone, address)", async () => {
    const errors = await validationErrors(
      { ...baseValues, type: "HQ", name: "", code: " ", phone_number: "+99890", address: "" },
      { isHqBranch: true },
    );

    expect(Object.keys(errors).sort()).toEqual(["address", "code", "name", "phone_number"]);
    expect(errors.type).toBeUndefined();
    expect(errors.parent_id).toBeUndefined();
  });
});

describe("branchEditSchema — oddiy filiallar (o'zgarmagan)", () => {
  it.each([undefined, { isHqBranch: false }])("rejects type HQ (context %j)", async (context) => {
    const errors = await validationErrors({ ...baseValues, type: "HQ", parent_id: "1" }, context);

    expect(errors.type).toContain(i18n.t("branches:validation.hqDisabled"));
  });

  it.each(["REGIONAL", "HYBRID"])("requires a parent for a %s branch", async (type) => {
    const errors = await validationErrors({ ...baseValues, type, code: "SAM" });

    expect(errors.parent_id).toEqual([i18n.t("branches:validation.parent")]);
  });

  it("accepts a REGIONAL branch with a parent", async () => {
    expect(await validationErrors({ ...baseValues, type: "REGIONAL", code: "SAM", parent_id: "1" })).toEqual({});
  });

  // Ilgari PICKUP uchun yuqori filial ixtiyoriy edi va saqlashda `parent_id: ""`
  // ketardi — backend buni rad etadi, ya'ni PICKUP'ni tahrirlab bo'lmasdi.
  it("⭐ requires a parent for a PICKUP branch too", async () => {
    const errors = await validationErrors({ ...baseValues, type: "PICKUP", code: "PNT" });

    expect(errors.parent_id).toEqual([i18n.t("branches:validation.parent")]);
  });

  it("accepts a PICKUP branch with a parent", async () => {
    expect(await validationErrors({ ...baseValues, type: "PICKUP", code: "PNT", parent_id: "1" })).toEqual({});
  });
});
