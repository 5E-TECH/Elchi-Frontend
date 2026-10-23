/** Bosh harflar (maket `.el-avatar`: «MX»): ikki so'zning birinchi harflari, bitta so'z — ikki harf. */
export const operatorInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toLocaleUpperCase();
  return (parts[0]?.slice(0, 2) ?? "").toLocaleUpperCase();
};
