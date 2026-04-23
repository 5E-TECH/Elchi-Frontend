import type { User } from "../types/user";

export const unwrapUserResponse = (value: unknown): User | undefined => {
  const payload = value as
    | User
    | { data?: User | { data?: User } }
    | undefined;

  if (!payload) return undefined;

  if ("data" in payload && payload.data) {
    const nestedData = payload.data;

    if (
      typeof nestedData === "object" &&
      nestedData !== null &&
      "data" in nestedData &&
      nestedData.data
    ) {
      return nestedData.data;
    }

    return nestedData as User;
  }

  return payload as User;
};

