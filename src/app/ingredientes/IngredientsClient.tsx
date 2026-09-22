"use client";

import { useMemo, useState } from "react";
import type { MasterIngredient, Recipe } from "@/lib/types";

export default function IngredientsClient({
  ingredients,
  recipes,
}: {
  ingredients: MasterIngredient[];
  recipes: Recipe[];
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [avail, setAvail] = useState("");
  const [onlyRestrictive, setOnlyRestrictive] = useState(false);

  const groups = useMemo(
    () => Array.from(new Set(ingredients.map((i) => i.group))).sort(),
    [ingredients]
  );

  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of recipes) {
      for (const pid of r.restrictive_product_ids) map.set(pid, (map.get(pid) ?? 0) + 1);
    }
    return map;
  }, [recipes]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ingredients
      .filter((i) => (q ? i.name.toLowerCase().includes(q) : true))
      .filter((i) => (group ? i.group === group : true))
      .filter((i) => (avail ? i.availability === avail : true))
      .filter((i) => (onlyRestrictive ? i.restrictive : true))
      .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  }, [ingredients, query, group, avail, onlyRestrictive]);

  const counts = {
    total: ingredients.length,
    restrictive: ingredients.filter((i) => i.restrictive).length,
    par: ingredients.filter((i) => i.availability === "par").length,
    impar: ingredients.filter((i) => i.availability === "impar").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { v: counts.total, l: "Ingredientes" },
          { v: counts.restrictive, l: "Restrictivos" },
          { v: counts.par, l: "Semana par" },
          { v: counts.impar, l: "Semana impar" },
        ].map((c) => (
          <div key={c.l} className="card px-5 py-3">
            <div className="text-2xl font-bold text-corp-600">{c.v}</div>
            <div className="text-[12px] font-semibold text-navy-800">{c.l}</div>
          </div>
        ))}
      </div>

      <section className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label">Buscar</label>
          <input
            className="input"
            placeholder="Nombre del ingrediente…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Grupo</label>
          <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">Todos</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Disponibilidad</label>
          <select className="input" value={avail} onChange={(e) => setAvail(e.target.value)}>
            <option value="">Todas</option>
            <option value="par">Semana par</option>
            <option value="impar">Semana impar</option>
            <option value="todas">Sin restricción</option>
          </select>
        </div>
        <label className="flex h-[38px] items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={onlyRestrictive}
            onChange={(e) => setOnlyRestrictive(e.target.checked)}
          />
          Solo restrictivos
        </label>
      </section>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className="th">Ingrediente</th>
              <th className="th">Grupo</th>
              <th className="th">Disponibilidad</th>
              <th className="th">Restrictivo</th>
              <th className="th">Preparaciones</th>
              <th className="th">Nota</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className={`hover:bg-corp-100/40 ${i.use_in_menu ? "" : "opacity-55"}`}>
                <td className="td font-semibold text-navy-800">
                  {i.name}
                  {!i.use_in_menu ? (
                    <span className="badge ml-2 bg-slate-200 text-slate-600">No va en el menú</span>
                  ) : null}
                </td>
                <td className="td">{i.group}</td>
                <td className="td">
                  {i.availability === "todas" ? (
                    <span className="badge bg-slate-100 text-slate-600">TODAS</span>
                  ) : (
                    <span
                      className={`badge ${
                        i.availability === "par" ? "bg-navy-800 text-white" : "bg-corp-500 text-white"
                      }`}
                    >
                      {i.availability.toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="td">{i.restrictive ? "Sí" : "—"}</td>
                <td className="td">{i.restrictive ? usage.get(i.id) ?? 0 : "—"}</td>
                <td className="td text-[12px] text-muted">{i.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
