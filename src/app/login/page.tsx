import { login } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  const error = searchParams?.error;
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-shell px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-corp-700">Sistema de control</div>
          <h1 className="mt-2 text-2xl font-semibold text-navy-900">Proyecto de Mejora de Alimentación IPSP</h1>
          <p className="mt-2 text-sm text-muted">Ingrese con su usuario y contraseña.</p>
        </div>
        <section className="surface p-7">
          <form action={login} className="space-y-4">
            <div>
              <label className="label" htmlFor="username">Usuario</label>
              <input id="username" name="username" className="input mt-1" autoComplete="username" autoFocus required />
            </div>
            <div>
              <label className="label" htmlFor="password">Contraseña</label>
              <input id="password" name="password" type="password" className="input mt-1" autoComplete="current-password" required />
            </div>
            {error ? <div className="notice-warn">{error}</div> : null}
            <button type="submit" className="btn-primary w-full justify-center">Iniciar sesión</button>
          </form>
        </section>
      </div>
    </main>
  );
}
