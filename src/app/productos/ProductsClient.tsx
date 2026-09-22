"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { actionSaveProduct } from "@/app/actions";
import { WEEKDAYS } from "@/lib/types";
import type { Recipe, RestrictiveProduct, Weekday } from "@/lib/types";

const EMPTY: RestrictiveProduct = {
  id: "",
  name: "",
  parity: "todas",
  category: "Otro",
  arrival_weekday: null,
  active: true,
  notes: null,
};

export default function ProductsClient({
  products,
  recipes,
}: {
  products: RestrictiveProduct[];
  recipes: Recipe[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<(RestrictiveProduct & { isNew?: boolean }) | null>(null);
  const [saving, setSaving] = useState(false);

  const usage = (id: string) => recipes.filter((r) => r.restrictive_product_ids.includes(id)).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setEditing({ ...EMPTY, isNew: true })}>
          + Nuevo producto
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr>
              <th className="th">Producto</th>
              <th className="th">Categoría</th>
              <th className="th">Semana disponible</th>
              <th className="th">Día de llegada</th>
              <th className="th">Preparaciones</th>
              <th className="th">Activo</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-corp-100/40">
                <td className="td font-semibold text-navy-800">{p.name}</td>
                <td className="td">{p.category}</td>
                <td className="td">
                  {p.parity === "todas" ? (
                    <span className="badge bg-slate-100 text-slate-600">TODAS</span>
                  ) : (
                    <span
                      className={`badge ${
                        p.parity === "par" ? "bg-navy-800 text-white" : "bg-corp-500 text-white"
                      }`}
                    >
                      {p.parity.toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="td">
                  {p.arrival_weekday === null ? (
                    <span className="text-muted">Con el despacho principal</span>
                  ) : (
                    WEEKDAYS[p.arrival_weekday].label
                  )}
                </td>
                <td className="td">{usage(p.id)}</td>
                <td className="td">{p.active ? "Sí" : "No"}</td>
                <td className="td text-right">
                  <button className="btn-ghost btn-sm" onClick={() => setEditing({ ...p })}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? "Nuevo producto restrictivo" : "Editar producto"}
      >
        {editing ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Nombre</label>
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Categoría</label>
                <input
                  className="input"
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Semana disponible</label>
                <select
                  className="input"
                  value={editing.parity}
                  onChange={(e) =>
                    setEditing({ ...editing, parity: e.target.value as RestrictiveProduct["parity"] })
                  }
                >
                  <option value="todas">Todas</option>
                  <option value="par">Solo par</option>
                  <option value="impar">Solo impar</option>
                </select>
              </div>
              <div>
                <label className="label">Día de llegada</label>
                <select
                  className="input"
                  value={editing.arrival_weekday ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      arrival_weekday: e.target.value === "" ? null : (Number(e.target.value) as Weekday),
                    })
                  }
                >
                  <option value="">Con el despacho principal</option>
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
              Activo
            </label>

            <div>
              <label className="label">Observaciones</label>
              <textarea
                className="input"
                rows={2}
                value={editing.notes ?? ""}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value || null })}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <button className="btn-ghost" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                disabled={saving || !editing.name.trim()}
                onClick={async () => {
                  setSaving(true);
                  await actionSaveProduct(editing);
                  setSaving(false);
                  setEditing(null);
                  router.refresh();
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
