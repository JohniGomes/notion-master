import type { TaskStatus } from "@/lib/supabase/types";
import { STATUS_LABEL, STATUS_STYLE } from "@/components/status";
import clsx from "clsx";

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLE[status].badge
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", STATUS_STYLE[status].dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}
