import { describe, expect, it } from "vitest";
import { toRows } from "./toRows";

describe("toRows", () => {
  it("returns a plain array as is", () => {
    expect(toRows([{ id: "1" }])).toEqual([{ id: "1" }]);
  });

  it("unwraps the backend envelope { data: { items } }", () => {
    expect(
      toRows({ statusCode: 200, message: "success", data: { items: [{ id: "1" }], meta: {} } }),
    ).toEqual([{ id: "1" }]);
  });

  it("unwraps { data: [] } and { items: [] }", () => {
    expect(toRows({ data: [{ id: "2" }] })).toEqual([{ id: "2" }]);
    expect(toRows({ items: [{ id: "3" }] })).toEqual([{ id: "3" }]);
  });

  it("returns an empty array for anything else", () => {
    expect(toRows(undefined)).toEqual([]);
    expect(toRows(null)).toEqual([]);
    expect(toRows("x")).toEqual([]);
    expect(toRows({ data: { total: 3 } })).toEqual([]);
  });
});
