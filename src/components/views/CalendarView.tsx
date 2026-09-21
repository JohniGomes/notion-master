"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { TaskWithAssignee } from "@/lib/data/tasks";
import { STATUS_STYLE } from "@/components/status";

export function CalendarView({
  tasks,
  onOpenTask,
}: {
  tasks: TaskWithAssignee[];
  onOpenTask: (id: string) => void;
}) {
  const [month, setMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithAssignee[]>();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const key = t.due_date;
      map.set(key, [...(map.get(key) ?? []), t]);
    });
    return map;
  }, [tasks]);

  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize text-neutral-700">
          {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
        </h3>
        <div className="flex gap-1">
          <button onClick={() => setMonth((m) => subMonths(m, 1))} className="rounded p-1 hover:bg-neutral-100">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="rounded p-1 hover:bg-neutral-100">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 text-xs">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="bg-neutral-50 px-2 py-1 text-center font-medium text-neutral-500">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={clsx(
                "min-h-24 bg-white p-1.5",
                !isSameMonth(day, month) && "bg-neutral-50 text-neutral-300",
                isSameDay(day, new Date()) && "ring-1 ring-inset ring-neutral-400"
              )}
            >
              <p className="mb-1 text-right text-[11px] text-neutral-400">{format(day, "d")}</p>
              <div className="flex flex-col gap-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onOpenTask(t.id)}
                    className={clsx(
                      "truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium",
                      STATUS_STYLE[t.status].badge
                    )}
                  >
                    {t.title}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-neutral-400">+{dayTasks.length - 3} mais</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
