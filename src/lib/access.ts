export type AppRole = "admin_general" | "admin" | "viewer";

export function appRole(): AppRole {
  const raw = (process.env.APP_ROLE ?? "admin_general").toLowerCase();
  if (["admin_general", "general_admin", "superadmin", "owner"].includes(raw)) return "admin_general";
  if (["viewer", "readonly", "read_only"].includes(raw)) return "viewer";
  return "admin";
}

export function isGeneralAdmin() {
  return appRole() === "admin_general";
}

export function canManageExecution() {
  return appRole() !== "viewer";
}

export function assertGeneralAdmin() {
  if (!isGeneralAdmin()) throw new Error("Esta acción está reservada al Administrador General.");
}

export function assertCanManageExecution() {
  if (!canManageExecution()) throw new Error("Este usuario tiene acceso de solo lectura.");
}
