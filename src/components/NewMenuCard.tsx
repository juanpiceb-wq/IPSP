"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parityOfWeek } from "@/lib/rules";
import { cycleDates, formatDate } from "@/lib/dates";
import { WEEKDAYS } from "@/lib/types";
import type { Camp, Weekday } from "@/lib/types";

export default function NewMenuCard({
  camps,
  defaultYear,
  defaultWeek,
}: {
  camps: Camp[];
  defaultYear: number;
  defaultWeek: number;
}) {
  const router = useRouter();
  const [year, setYear] = useState(defaultYear);
  const [week, setWeek] = useState(defaultWeek);
  const [campId, setCampId] = useState(camps[0]?.id ?? "");
  const [diners, setDiners] = useState(camps[0]?.diners_default ?? 100);
  const arrival = (camps.find((c) => c.id === campId)?.reception_weekday_default ?? 1) as Weekday;
  const parity = parityOfWeek(week);
  const dates = cycleDates(year, week, arrival);

  return (
    <section className="card p-5">
      <h2 className="text-base font-bold text-navy-800">Generar nuevo menú</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Año</label>
          <input type="number" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Número de semana</label>
          <input
            type="number"
            min={1}
            max={53}
            className="input"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Campamento</label>
          <select
            className="input"
            value={campId}
            onChange={(e) => {
              setCampId(e.target.value);
              const c = camps.find((x) => x.id === e.target.value);
              if (c) setDiners(c.diners_default);
            }}
          >
            {camps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Comensales</label>
          <input type="number" className="input" value={diners} onChange={(e) => setDiners(Number(e.target.value))} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-shell px-3 py-2.5">
        <span
          className={`badge ${parity === "par" ? "bg-navy-800 text-white" : "bg-corp-500 text-white"}`}
        >
          SEMANA {parity.toUpperCase()}
        </span>
        <span className="badge bg-corp-100 text-corp-700">
          Víveres: {WEEKDAYS[arrival].label.toLowerCase()}
        </span>
        <span className="text-[12px] text-muted">
          Uso real: {formatDate(dates.start)} → {formatDate(dates.end)}
        </span>
      </div>

      <button
        className="btn-primary mt-4 w-full"
        onClick={() =>
          router.push(`/generar?year=${year}&week=${week}&camp=${campId}&diners=${diners}`)
        }
      >
        Generar menú
      </button>
    </section>
  );
}
