import { CircleCheck, CircleX, Clock, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

const tones = {
  error: { Icon: CircleX, className: "text-error", label: "Грешка" },
  success: { Icon: CircleCheck, className: "text-success", label: "Успешно" },
  warning: { Icon: TriangleAlert, className: "text-warning", label: "Внимание" },
  pending: { Icon: Clock, className: "text-pending", label: "Информация" },
};

export function Feedback({ tone = "pending", children, id }: { tone?: keyof typeof tones; children: ReactNode; id?: string }) {
  const { Icon, className, label } = tones[tone];
  return <div id={id} role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-lg bg-surface-soft p-4 ${className}`}>
    <Icon aria-hidden="true" className="mt-1 size-5 shrink-0" />
    <div><span className="sr-only">{label}: </span>{children}</div>
  </div>;
}
