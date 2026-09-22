# Planificación de Alimentación · Menús semanales de campamentos

Aplicación web para **generar, validar, editar, guardar y consultar los menús semanales**
del servicio de alimentación de los campamentos, aplicando automáticamente las reglas del
*Manual para la Elaboración y Uso del Menú Semanal*.

No es un randomizador: es un **generador controlado por reglas** con puntuación de candidatos,
historial e explicabilidad de cada selección.

---

## 1. Qué incluye la beta

| Módulo | Estado |
|---|---|
| Generador de menú semanal (21 platos fuertes + 6 sopas (lunes a sábado) + ensaladas + bebidas) | ✅ |
| Reglas duras (servicio, sopas, paridad, disponibilidad, arroz, ensaladas) | ✅ |
| Preferencias con puntuación (frecuencias, variedad, origen animal, domingo) | ✅ |
| Validación en tiempo real con mensajes en lenguaje claro | ✅ |
| Edición manual por celda con filtrado de preparaciones válidas | ✅ |
| Bloqueo de comidas 🔒 y regeneración solo de lo no bloqueado | ✅ |
| Explicabilidad: por qué el sistema eligió cada plato | ✅ |
| Historial de menús + estados (borrador / aprobado / utilizado) + duplicar | ✅ |
| CRUD de preparaciones, proteínas, productos restrictivos y campamentos | ✅ |
| Cantidades estimadas por comensales | ✅ |
| Exportación: impresión / PDF y CSV | ✅ |
| Lista maestra de ingredientes (consulta y validación) | ✅ |
| Datos iniciales cargados (231 preparaciones, 83 ingredientes, 18 proteínas, 20 productos, 3 menús históricos) | ✅ |
| Autenticación y roles | Fase 2 (arquitectura preparada) |
| Tres propuestas simultáneas A/B/C con % de cumplimiento | Fase 2 (hoy: “Generar otra opción”) |

---

## 2. Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (tokens de la paleta corporativa en `src/app/globals.css`)
- **Supabase / PostgreSQL** como base de datos
- Server Actions para toda la escritura — sin API intermedia
- Motor de reglas en TypeScript puro (`src/lib/engine`), reutilizable y testeable

### Modo demo sin base de datos

Si **no** se configuran las variables de Supabase, la aplicación arranca en **MODO DEMO**
con un almacén en memoria ya cargado con todo el seed. Sirve para probar y demostrar sin
instalar nada; los cambios se pierden al reiniciar el servidor.

---

## 3. Instalación local

```bash
npm install
cp .env.example .env.local     # opcional: dejar vacío para MODO DEMO
npm run dev                    # http://localhost:3000
```

Comandos disponibles:

```bash
npm run dev        # desarrollo
npm run build      # compilación de producción
npm start          # servir la compilación
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm run smoke      # genera 4 semanas seguidas por consola y muestra la validación
npm run gen:sql     # regenera supabase/seed.sql desde el seed TypeScript
npm run gen:catalog # reconstruye el catálogo desde el maestro de platos e ingredientes
```

---

## 4. Supabase (persistencia real)

1. Cree un proyecto en <https://supabase.com>.
2. Abra **SQL Editor** y ejecute, en este orden:
   - `supabase/schema.sql` — tablas, índices y políticas RLS abiertas para la beta.
   - `supabase/seed.sql` — datos iniciales (proteínas, productos, catálogo y menús 37, 38 y 39).
3. En **Project Settings → API** copie `Project URL` y `anon public key`.
4. Complete `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

5. Reinicie `npm run dev`. La barra lateral debe mostrar **SUPABASE** en lugar de **MODO DEMO**.

> La RLS queda abierta a propósito para la beta (herramienta interna sin login).
> Al agregar autenticación, restrinja las políticas a `authenticated`.

---

## 5. Despliegue en Vercel

1. Suba el proyecto a un repositorio de GitHub.
2. En Vercel: **Add New → Project → Import** el repositorio.
3. Framework: *Next.js* (se detecta solo). Build: `npm run build`.
4. En **Settings → Environment Variables** agregue:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **Deploy**. Sin variables, el despliegue también funciona en MODO DEMO
   (útil para una demostración rápida, sin persistencia).

---

## 6. Cómo funciona el motor

`src/lib/engine/generate.ts`

1. Calcula la **paridad** de la semana (38 → par, 39 → impar).
2. Ordena los días según el **ciclo real de uso**: el menú empieza el día siguiente a la
   recepción de víveres (recepción martes → miércoles a martes).
3. Para cada uno de los 21 espacios de plato fuerte construye la lista de candidatos y
   **descarta por reglas duras**:
   - servicio permitido de la preparación;
   - proteínas exclusivas (huevo y atún solo desayuno; sardina solo almuerzo, excepto Corviche de sardina en desayuno; hueso, costilla y pata solo sopa);
   - paridad de la proteína y de cada producto restrictivo (todo fideo o pasta = semana par);
   - disponibilidad por día según el día de llegada del producto;
   - misma proteína ya usada ese día;
   - repetición de origen cerdo por encima de la excepción permitida;
   - receta ya utilizada en la semana.
4. **Puntúa** a los que sobreviven: frecuencia objetivo pendiente, historial reciente
   (últimas 8 semanas, con más peso a lo más cercano), mismo día/servicio en semanas
   anteriores, origen animal del día, preferencia de domingo y un componente aleatorio.
5. Elige al azar entre los candidatos de mejor puntuación → cada generación es distinta
   pero siempre lógica. La **semilla** se guarda para reproducir una propuesta.
6. Genera las 7 sopas con el mismo criterio (solo hueso carnudo, costilla o pata, o sin
   proteína animal), asigna ensaladas apuntando a 10 de 14 (mínimo 10) y las bebidas.
7. `src/lib/engine/validate.ts` vuelve a revisar todo el menú y produce el panel de validación.

### Frecuencias que exceden la capacidad

Los objetivos configurados suman **24 comidas** y la semana tiene **21 platos fuertes**.
El sistema **no rompe reglas para forzarlos**: genera la mejor combinación posible y avisa
en el panel de validación qué objetivos quedaron cortos y por qué.

---

## 7. Estructura del proyecto

```
src/
  app/
    page.tsx                 Dashboard
    generar/                 Generador (parámetros, tabla, validación, edición)
    menus/                   Historial + detalle/edición de cada menú
    preparaciones/           CRUD del catálogo de platos
    proteinas/               Configuración de proteínas y porciones
    productos/               Productos restrictivos
    ingredientes/            Lista maestra de ingredientes
    campamentos/             Campamentos
    reglas/                  Panel de reglas del sistema
    actions.ts               Server Actions (generar, validar, guardar, CRUD)
  components/                Sidebar, MenuTable, ValidationPanel, RecipePicker, Modal…
  lib/
    types.ts                 Tipos del dominio
    rules.ts                 Reglas estructurales (21 platos, 10/14 ensaladas, ciclo)
    dates.ts                 Semana ISO y ciclo real de uso
    portions.ts              Cálculo de cantidades por comensales
    engine/                  Motor: contexto, generación y validación
    db/                      Repositorio (Supabase + memoria) con la misma interfaz
    seed/data.ts             Datos iniciales (fuente única del seed y del SQL)
    seed/catalog.generated.ts  Catálogo generado desde el maestro (no editar a mano)
    seed/legacy-source.ts    Copia congelada del catálogo previo (insumo del generador)
supabase/
  schema.sql                 Esquema completo
  seed.sql                   Datos iniciales (generado con npm run gen:sql)
scripts/
  build-catalog.ts           Construye el catálogo desde MAESTRO_PLATOS_INGREDIENTES_IPSP.xlsx
  generate-sql.ts            Genera seed.sql desde el seed TypeScript
  smoke.ts                   Prueba del motor por consola
```

---

## 8. Datos iniciales

Provienen de `MAESTRO_PLATOS_INGREDIENTES_IPSP.xlsx`, del manual y de los menús reales:

- **18 proteínas** con origen animal, servicios permitidos, frecuencia objetivo y rendimiento
  exactamente como los define el manual.
- **83 ingredientes** de la lista maestra, con grupo, disponibilidad y nota. De ellos,
  **20 son restrictivos** y condicionan en qué semana puede utilizarse cada plato
  (16 de semana par, 7 de semana impar; los 3 insumos de limpieza quedan fuera del generador).
- **231 preparaciones**: 151 del maestro de platos + 57 platos de los menús 37, 38 y 39 que el
  maestro no incluye + 23 ensaladas. Cada una con proteína principal, servicios permitidos y
  productos restrictivos detectados.
- **3 menús históricos** (semanas 37, 38 y 39) cargados como historial, de modo que el motor
  evita repeticiones desde la primera generación.

Puntos marcados para revisión de operaciones (quedaron **inactivos** o señalados, no se
eliminaron ni se corrigieron por cuenta propia):

- **6 preparaciones inactivas**, todas sopas cuya proteína no está entre las tres permitidas:
  *Sopa de hueso con bola rellena con carne*, *Caldo de bola*, *Sopa de pollo y legumbres*,
  *Sopa de lenteja con sardina*, *Caldo de lentejas con chorizo* y *Caldo de bola de verde
  rellena de hamburguesa de res*. Se activan desde la app si la regla cambia.
- **2 preparaciones con el ítem “Verdura”** (*Arroz y ensalada de verdura y camarón frito* y
  *Sopa de verdura con hueso*): el maestro pide validar si corresponde al ítem restrictivo de
  semana par. Quedaron marcadas como semana par, que es la opción conservadora; si no aplica,
  se destilda el producto en la ficha de la preparación.
- **Camarón entero** aparece en los menús reales pero el manual no define su porción: queda
  como proteína con *“sin porción definida”*, sin cálculo de cantidades.
- Donde el menú real decía “Pescado” se usó la proteína **Tilapia**, que es la definida en el manual.

Para volver a cargar el catálogo desde una versión nueva del Excel: exportar las hojas a
`/tmp/master.json` con el mismo formato, ejecutar `npm run gen:catalog` y luego `npm run gen:sql`.

## 9. Flujo de demostración sugerido

1. **Inicio** → semana y paridad automáticas, KPIs y últimos menús.
2. **Generar menú** → semana 40, Corvinero, 120 comensales → *Generar menú*.
3. En segundos: 21 platos fuertes, 11/14 con ensalada, 0 errores críticos.
4. Clic en cualquier plato → **por qué lo seleccionó el sistema** y alternativas válidas.
5. Cambiar una preparación → la validación se recalcula al instante.
6. Bloquear 🔒 lo que ya gusta → *Regenerar no bloqueados*.
7. **Guardar y aprobar** → queda en el historial.
8. **Preparaciones** → crear una nueva con sus productos restrictivos; queda disponible para
   la siguiente generación.
9. **Reglas** → panel de consulta para cocina y administración.

---

*Master User: Juan Pablo Ceballos*


### Maduración de plátano por ciclo de recepción

- El ciclo real inicia el día siguiente a la recepción de víveres.
- Días 1 a 3: preparaciones con verde.
- Desde el día 4: preparaciones con maduro.
- El ceviche dominical con chifle conserva la excepción operativa de verde reservado/procesado dentro de la ventana válida.
- La regla se aplica también cuando "verde", "maduro", "patacón", "bolón", "tigrillo", "corviche" o "chifle" aparece como parte del nombre del plato y no como base dominante.
