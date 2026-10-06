"use client";

import { useCallback, useMemo, useState } from "react";
import { FilterDropdown, MONTHS, toggleIn } from "@/components/dashboards/theme";

// Filtros de Dia / Mes / Ano em varios-ao-mesmo-tempo (vazio = sem filtro).
export function useDateFilters(years: string[], defaultYear?: string) {
  const [days, setDays] = useState<Set<string>>(new Set());
  const [months, setMonths] = useState<Set<string>>(new Set());
  const [selectedYears, setSelectedYears] = useState<Set<string>>(
    new Set(defaultYear ? [defaultYear] : [])
  );

  const matches = useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return false;
      const year = iso.slice(0, 4);
      const month = iso.slice(5, 7);
      const day = String(Number(iso.slice(8, 10)));
      if (selectedYears.size > 0 && !selectedYears.has(year)) return false;
      if (months.size > 0 && !months.has(month)) return false;
      if (days.size > 0 && !days.has(day)) return false;
      return true;
    },
    [days, months, selectedYears]
  );

  // Periodo anterior: so existe com exatamente 1 mes e 1 ano marcados (janeiro compara com dezembro).
  const previous = useMemo(() => {
    if (months.size !== 1 || selectedYears.size !== 1) return null;
    const month = Number(Array.from(months)[0]);
    const year = Number(Array.from(selectedYears)[0]);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthStr = String(prevMonth).padStart(2, "0");
    return {
      label: `${MONTHS[prevMonth - 1]}/${String(prevYear).slice(2)}`,
      matches: (iso: string | null | undefined) => {
        if (!iso) return false;
        if (iso.slice(0, 4) !== String(prevYear) || iso.slice(5, 7) !== prevMonthStr) return false;
        return days.size === 0 || days.has(String(Number(iso.slice(8, 10))));
      },
    };
  }, [days, months, selectedYears]);

  const ui = useMemo(
    () => (
      <>
        <FilterDropdown
          title="Dia"
          cols={7}
          options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
          selected={days}
          onToggle={(v) => setDays((s) => toggleIn(s, v))}
          onClear={() => setDays(new Set())}
        />
        <FilterDropdown
          title="Mês"
          cols={4}
          options={MONTHS.map((m, i) => ({ value: String(i + 1).padStart(2, "0"), label: m }))}
          selected={months}
          onToggle={(v) => setMonths((s) => toggleIn(s, v))}
          onClear={() => setMonths(new Set())}
        />
        <FilterDropdown
          title="Ano"
          cols={1}
          options={years.map((y) => ({ value: y, label: y }))}
          selected={selectedYears}
          onToggle={(v) => setSelectedYears((s) => toggleIn(s, v))}
          onClear={() => setSelectedYears(new Set())}
        />
      </>
    ),
    [days, months, selectedYears, years]
  );

  return { matches, ui, selectedYears, previous };
}
