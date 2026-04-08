export const queryKeys = {
  notifications: {
    all: ["notifications"] as const,
    list: (params: object) => ["notifications", "list", params] as const,
    detail: (id: string) => ["notifications", "detail", id] as const,
  },
  branches: {
    all: ["branches"] as const,
    list: (params: object) => ["branches", "list", params] as const,
    detail: (id: string) => ["branches", "detail", id] as const,
    employees: (id: string) => ["branches", id, "employees"] as const,
    settings: (id: string) => ["branches", id, "settings"] as const,
  },
  users: {
    all: ["users"] as const,
    list: (params?: object) => ["users", "list", params ?? {}] as const,
  },
  regions: {
    all: ["regions"] as const,
  },
} as const;
