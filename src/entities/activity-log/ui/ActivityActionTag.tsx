import { Tag } from "antd";
import { memo } from "react";

// Action verbs are backend-defined (ActivityAction enum) and open-ended, so we
// colour by keyword rather than an exhaustive map, and humanise the label.
const colorForAction = (action: string): string => {
  const a = action.toLowerCase();
  if (/(create|add|register|open|assign)/.test(a)) return "green";
  if (/(delete|remove|cancel|reject|close|fail)/.test(a)) return "red";
  if (/(status|state|approve|confirm|pay|settle)/.test(a)) return "gold";
  if (/(login|logout|auth|refresh|password)/.test(a)) return "geekblue";
  if (/(update|edit|change|move|transfer)/.test(a)) return "blue";
  return "default";
};

const humanize = (action: string): string =>
  action.replace(/[._]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

const ActivityActionTag = ({ action }: { action: string }) => {
  if (!action) return <span>—</span>;
  return (
    <Tag color={colorForAction(action)} style={{ marginInlineEnd: 0 }}>
      {humanize(action)}
    </Tag>
  );
};

export default memo(ActivityActionTag);
