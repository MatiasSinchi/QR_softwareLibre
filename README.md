# Cupones QR para la directiva

Aplicación web pequeña para gestionar la **venta anticipada y la entrega de combos de comida** de una
recaudación de fondos universitaria.

- Los compradores **no tienen cuentas**: solo reciben un enlace/QR con su cupón.
- Una sola persona administra: registra compras, genera el cupón QR y, el día de la entrega, escanea
  los cupones desde el celular.
- Un cupón **solo se puede entregar una vez**, aunque dos celulares lo escaneen al mismo tiempo.
- No procesa pagos: el administrador verifica las transferencias por fuera y las registra aquí.

## Cómo funciona

```
Administrador (React, Vercel) ──Supabase Auth──►  Supabase (PostgreSQL + RLS)
Comprador  /cupon/<token>     ──función pública─►  get_public_coupon(token)
Escáner    /admin/scan        ──funciones admin─►  lookup_coupon / deliver_coupon
```

No hay servidor propio. El navegador habla directamente con Supabase y **toda la seguridad vive en la
base de datos**:

- Las tablas están cerradas con **Row Level Security (RLS)**: un visitante no puede leer ni escribir nada.
- Solo los usuarios que aparecen en la tabla `admin_profiles` son administradores.
- Toda escritura sobre pedidos pasa por funciones SQL (`create_order`, `confirm_payment`,
  `deliver_coupon`) que validan permisos y datos **dentro de la base de datos**.
- La entrega es un único `UPDATE` condicionado: es atómica. Si dos solicitudes llegan a la vez, solo una gana.
- El enlace del cupón contiene un token aleatorio de 122 bits generado por PostgreSQL. Solo existe cuando el pago está confirmado.
- La página pública solo recibe 5 datos: nombre, combo, cantidad, código corto y estado.

### Estructura del proyecto

```
src/
  pages/        Login, Admin (panel), Scan (escáner), PublicCoupon (cupón del comprador)
  components/   formulario de compra, lista de pedidos, combos, tarjeta del cupón, diálogo del cupón…
  lib/          cliente Supabase, autenticación, validaciones, dinero, lógica del escáner
supabase/
  migrations/   esquema, seguridad (RLS), funciones y estadísticas — versionadas
  tests/        pruebas SQL (pgTAP) y prueba de concurrencia
  seed.sql      combos de ejemplo SOLO para desarrollo local
tests/integration/   pruebas de la API con el cliente real (contra Supabase local)
docs/                comprobaciones manuales
```

## Requisitos previos

| Herramienta | Para qué | Notas |
|---|---|---|
| **Node.js 22** | ejecutar y compilar | Se fija con `.nvmrc`. Con [fnm](https://github.com/Schniz/fnm): `fnm install 22 && fnm use` |
| Cuenta de **Supabase** | base de datos y login | Plan gratuito suficiente |
| Cuenta de **Vercel** y un repositorio en **GitHub** | publicar la web | Plan gratuito suficiente |
| **Supabase CLI** | aplicar las migraciones | macOS: `brew install supabase/tap/supabase` |
| *Opcional:* Docker (Colima o Docker Desktop) | base de datos local y pruebas SQL | Con 8 GB de RAM basta `colima start --cpu 2 --memory 2` |

## Instalación

```bash
fnm use            # activa Node 22 (lee .nvmrc)
npm install
```

## Configuración del proyecto en Supabase

### 1. Crear el proyecto

En [supabase.com](https://supabase.com) → **New project**. Elige región, pon una contraseña de base de datos
(guárdala en un gestor de contraseñas) y anota el **Project ref** (el código de la URL del panel).

### 2. Cerrar el registro público

**Authentication → Sign In / Providers →** desactiva **Allow new users to sign up**.
Así nadie puede crearse una cuenta. Aunque alguien lo lograra, sin una fila en `admin_profiles` no tendría ningún acceso.

### 3. Aplicar las migraciones

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

`db push` ejecuta, en orden, los archivos de `supabase/migrations/`. Reproduce la base de datos desde cero.
No uses `supabase db reset` contra la nube: borra los datos. El archivo `seed.sql` **no** se aplica con `db push`.

### 4. Crear el primer administrador

1. **Authentication → Users → Add user → Create new user**: tu correo y una contraseña larga y única.
   Marca **Auto Confirm User**.
2. En el **SQL Editor** ejecuta (cambiando el correo):

   ```sql
   insert into public.admin_profiles (user_id)
   select id from auth.users where email = 'TU_CORREO';
   ```

Para añadir otro administrador, repite los pasos 1 y 2. Para quitarle el acceso:
`delete from public.admin_profiles where user_id = (select id from auth.users where email = 'CORREO');`

### 5. Copiar las claves públicas

**Project Settings → API:** copia la **Project URL** y la clave **anon / publishable**.
**Nunca copies la `service_role` ni la *secret key***: dan acceso total y no deben estar en este proyecto.

## Variables de entorno

Copia `.env.example` y completa los valores. Son todas **públicas** (van dentro del JavaScript del navegador):

| Variable | Obligatoria | Qué es |
|---|---|---|
| `VITE_SUPABASE_URL` | Sí | URL del proyecto, `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Sí | Clave anon / publishable |
| `VITE_PUBLIC_APP_URL` | Recomendada | URL pública de la app, sin barra final. Es la dirección que se escribe **dentro del QR** |
| `VITE_PICKUP_INFO` | No | Texto con lugar y fecha de entrega que aparece en cada cupón |

Los archivos `.env*` están en `.gitignore` (excepto `.env.example`): **no se suben a Git ni a Vercel**.

## Ejecución local

Hay dos formas de trabajar. Elige una.

**A) Contra tu proyecto de Supabase en la nube**

```bash
cp .env.example .env.cloud        # y completa URL y clave de tu proyecto
npm run dev:cloud                 # http://localhost:5173
```

**B) Contra una base de datos local (Docker)** — recomendada para probar sin tocar datos reales

```bash
colima start --cpu 2 --memory 2  # solo si usas Colima; con 2 GB alcanza
npm run db:start                  # arranca Supabase local y aplica las migraciones + seed
supabase status -o env            # muestra API_URL y ANON_KEY locales
# crea .env.local con VITE_SUPABASE_URL=<API_URL> y VITE_SUPABASE_ANON_KEY=<ANON_KEY>
bash scripts/crear-admin-local.sh admin@local.test 'UnaClaveLarga123!'   # usuario administrador local
npm run dev
```

`db:start` omite Studio y otros servicios que no se usan, para gastar poca memoria (~400 MB).
Al terminar: `npm run db:stop` (y `colima stop`). `npm run db:reset` borra y recrea la base local.

## Pruebas

| Comando | Qué comprueba | Necesita |
|---|---|---|
| `npm test` | Lógica del frontend: dinero, validaciones, mensajes, lectura de códigos, tarjeta del cupón | solo Node |
| `npm run db:test` | 75 pruebas SQL (pgTAP): permisos, RLS, restricciones, entrega, estadísticas + prueba de concurrencia (10 solicitudes simultáneas, solo 1 entrega) | Supabase local |
| `npm run test:integration` | 36 pruebas de la API con el cliente real: login, compras, validaciones, fugas de datos, usuarios sin permiso, **20 entregas simultáneas del mismo cupón** | Supabase local |
| `npm run test:all` | Todo lo anterior | Supabase local |
| `npm run typecheck` / `npm run build` | Tipos y compilación | solo Node |

> Las pruebas de integración usan la clave `service_role` *local* para crear usuarios de prueba y **se
> niegan a ejecutarse contra cualquier URL que no sea local**.

Las comprobaciones que requieren un celular o personas reales están en
[`docs/pruebas-manuales.md`](docs/pruebas-manuales.md).

## Despliegue en Vercel

1. Sube el repositorio a GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio.
   Vercel detecta Vite solo (build `npm run build`, salida `dist`). En **Settings → General → Node.js Version** elige **22.x**.
3. Antes de desplegar, en **Environment Variables** añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
   (y opcionalmente `VITE_PICKUP_INFO`). Pulsa **Deploy**.
4. Vercel te da una URL, por ejemplo `https://cupones-directiva.vercel.app`. Continúa con la sección siguiente.
5. En Supabase → **Authentication → URL Configuration**, pon esa URL en **Site URL**.

`vercel.json` ya incluye el *rewrite* necesario para que `/cupon/...` funcione al abrirlo directamente, y las
cabeceras de seguridad (CSP, `X-Frame-Options`, `Referrer-Policy: no-referrer`, permiso de cámara solo para el propio sitio).

> Despliega siempre desde Vercel. Un `npm run build` en tu equipo incrusta tu `.env.local` (la base local).

## Configurar la URL pública de los cupones

El QR y el enlace compartido se arman con `VITE_PUBLIC_APP_URL`. Como la URL real solo se conoce tras el primer despliegue:

1. Despliega (paso anterior) y copia la URL que te dio Vercel.
2. En Vercel → **Settings → Environment Variables**, añade `VITE_PUBLIC_APP_URL` con esa URL (sin barra final).
3. **Deployments → ⋯ → Redeploy.** Las variables se incorporan al compilar: cambiarlas exige redesplegar.
4. Comprueba: registra una compra de prueba y mira que el enlace del cupón empiece por tu URL de Vercel.

Si no la defines, se usa la dirección desde la que abres el panel. Aun así conviene fijarla, para que
los QR apunten siempre al dominio correcto. Si más adelante usas un dominio propio, actualiza la variable, redespliega y,
si usas un dominio propio de Supabase, ajusta `connect-src` en la CSP de `vercel.json`.

**Importante:** cambiar la URL pública después de emitir cupones deja inservibles los QR ya compartidos
(el token sigue siendo válido, pero el enlace apuntaría al dominio viejo). Fíjala antes de empezar a vender.

## Pruebas de cámara desde el celular

La cámara del navegador **solo funciona en HTTPS** (o `localhost`). Por eso se prueba con la URL de Vercel,
no con `http://IP-de-tu-red`.

1. En el celular abre `https://TU-APP.vercel.app/admin/scan` e inicia sesión.
2. Pulsa **Activar cámara** y acepta el permiso. Si lo denegaste: ajustes del navegador → permisos del sitio → Cámara.
3. En otro dispositivo, muestra un cupón de prueba y apúntalo. Debe aparecer «Listo para entregar».
4. Prueba también el campo de código manual.

Probar en **iPhone/Safari** y en **Android/Chrome** si tienes ambos. La linterna aparece solo si el dispositivo la soporta.

## Procedimiento de uso

### Registrar una compra

1. Recibe y **verifica** el pago en tu banco.
2. Abre el panel (`/admin`) → **Registrar compra**: nombre, contacto (opcional), combo, cantidad y estado del pago.
   El precio se rellena con el del combo. El total lo calcula el servidor.
3. Con **Pagado** marcado, confirma el aviso → se genera el cupón y aparece su QR.
4. Muestra el QR para que el comprador lo escanee con su cámara, o pulsa **Compartir / Copiar enlace** y envíalo por WhatsApp.
5. Pídele que **guarde una captura de pantalla** del cupón.

Si el pago aún no llegó, elige **Pendiente de pago**: queda registrado **sin cupón**. Cuando verifiques el pago pulsa
**Confirmar pago** en la lista y se generará el cupón.

### Entregar un pedido

1. Abre `/admin/scan` en el celular → **Activar cámara** y escanea el QR (o la captura del comprador).
2. Revisa nombre, combo y cantidad. Si dice **Listo para entregar**, entrega el producto,
   pulsa **Marcar como entregado** y confirma.
3. Si dice **YA FUE ENTREGADO** (con fecha), **no entregues**. Si dice **Pago NO confirmado** o **Código inválido**, tampoco.
4. Si la cámara falla, escribe el código de 6 caracteres que aparece en el cupón.

## Seguridad: qué está protegido y qué debes saber

- **Sin claves secretas en el navegador.** Solo la clave anon/publishable, que es pública por diseño.
- **Los permisos no dependen de React.** Aunque alguien manipule el frontend, la base de datos rechaza lo no autorizado.
  Una prueba automática falla si se añade una función o tabla sin cerrar sus permisos.
- **Ni siquiera el administrador escribe en `orders` directamente**: solo mediante las funciones validadas.
- **Cupones inmutables:** un pedido pagado no puede volver a «pendiente» ni una entrega deshacerse (lo impide un trigger
  incluso desde el SQL Editor).
- **Quien tenga el enlace del cupón puede verlo** (nombre, combo, cantidad, código corto y estado). No puede modificar nada.
  Trata el enlace como un secreto: no lo publiques.
- **Protege tu cuenta de administrador:** contraseña larga y única, y activa la verificación en dos pasos si tu plan lo permite.
- La web declara `noindex` y envía `Referrer-Policy: no-referrer` para que los enlaces no se indexen ni se filtren.

## Mantenimiento y consejos para el día del evento

- **Plan gratuito de Supabase:** los proyectos inactivos durante ~1 semana se pausan. Entra al panel unos días antes
  del evento; si se pausó, restáuralo desde el dashboard de Supabase.
- **Copia de seguridad:** en Supabase → **Table Editor → orders → Export to CSV** antes del día de la entrega.
- **Si falla internet el día de la entrega:** el escáner necesita conexión. Ten a mano una exportación CSV con
  nombres y códigos cortos como respaldo para verificar a mano, y anota las entregas para registrarlas después.
- Límite de la lista de pedidos: se cargan los 1000 más recientes; las estadísticas cuentan todos.

## Solución de problemas

| Síntoma | Causa probable |
|---|---|
| «Falta configurar Supabase» | Falta `.env.local`/`.env.cloud` o variables en Vercel (y redesplegar) |
| Tras iniciar sesión: «Sin autorización» | Tu usuario no está en `admin_profiles` (paso 4) |
| El panel da error al cargar estadísticas | Falta aplicar alguna migración: `supabase db push` |
| Los QR apuntan a `localhost` | `VITE_PUBLIC_APP_URL` mal puesta en Vercel; corrige y redespliega |
| «La cámara solo funciona en páginas HTTPS» | Estás usando `http://` con una IP; usa la URL de Vercel |
| La cámara no inicia | Permiso denegado u otra app usando la cámara; usa el código manual |
| `/cupon/...` da 404 al abrirlo directo | Falta `vercel.json` en el repositorio |
| Error de versión de Node al instalar | Usa Node 22 (`fnm use`) |
