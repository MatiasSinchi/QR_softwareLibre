# Comprobaciones manuales

Estas pruebas necesitan un celular, otro dispositivo o personas reales, y no se pueden automatizar del todo.
Hazlas contra la **versión desplegada en Vercel** (HTTPS), con datos de prueba, **antes del evento**.

Las pruebas automáticas (`npm run test:all`) ya cubren la lógica, los permisos y la concurrencia: ver el README.

Marca cada casilla al completarla y anota la fecha y el dispositivo.

## 1. Flujo del administrador

- [ ] **Login.** Entra con tu correo y contraseña. Con una contraseña incorrecta aparece «Correo o contraseña incorrectos».
- [ ] **Sin sesión.** En una ventana privada abre `/admin` y `/admin/scan`: ambas redirigen al login.
- [ ] **Crear un combo** (nombre y precio) y comprobar que aparece en el formulario. Desactívalo y comprueba que deja de aparecer.
- [ ] **Compra pagada.** Registra una compra con «Pagado»: pide confirmación, se abre el cupón con el QR y el pedido figura como Pagado / Pendiente de entrega.
- [ ] **Compra pendiente.** Registra otra con «Pendiente de pago»: **no** se genera cupón; en la lista no aparece «Ver cupón».
- [ ] **Confirmar pago.** En esa compra pulsa «Confirmar pago»: pide confirmación y se abre su cupón.
- [ ] **Estadísticas.** Los totales de arriba cuadran con la lista. El «Recaudado» suma solo los pedidos pagados.
- [ ] **Valores inválidos.** Prueba cantidad 0, 101, 1.5 y texto; precio 0, negativo, «abc» y con 3 decimales; nombre vacío. Cada uno muestra un error y no guarda nada.
- [ ] **Búsqueda y filtros.** Busca por nombre y por código corto; filtra por pago y por entrega.

## 2. Cupón y enlace público

- [ ] **Copiar enlace** y pegarlo en el navegador de **otro dispositivo** (sin sesión): se ve el cupón.
- [ ] **Compartir** (en el celular): se abre el menú del sistema; cancelarlo no muestra errores. En un navegador sin esa función, el botón aparece deshabilitado y «Copiar enlace» funciona.
- [ ] **Imprimir / guardar PDF:** la vista previa muestra solo el cupón, sin botones ni el panel.
- [ ] **Escanear el QR del cupón con la cámara normal del celular** abre la página del cupón en el dominio de Vercel (no `localhost`).
- [ ] **Captura de pantalla** del cupón en el celular del comprador: el QR se ve nítido y se puede escanear desde la captura.
- [ ] **Enlace manipulado:** cambia un carácter del token en la URL → «Cupón no válido». Abre `/cupon/hola` → «Cupón no válido».
- [ ] **Privacidad:** la página pública no muestra contacto, precio, total ni datos de otros pedidos, y no tiene botones para cambiar nada.

## 3. Escáner (en el celular, con HTTPS)

- [ ] **Permiso de cámara:** «Activar cámara» pide permiso. Si lo deniegas, aparece un mensaje claro y el código manual sigue funcionando.
- [ ] **Escanear un cupón válido** (desde la pantalla de otro dispositivo): muestra «Listo para entregar» con nombre, combo y cantidad correctos.
- [ ] **Entregar:** «Marcar como entregado» → «Sí, entregar» → «Entrega registrada».
- [ ] **Segundo escaneo del mismo cupón:** muestra «YA FUE ENTREGADO» con la fecha y **sin** botón de entrega.
- [ ] **Pedido sin pagar** (escribe su código corto): «Pago NO confirmado», sin botón de entrega.
- [ ] **Código inexistente** (por ejemplo `ZZZZZ9`): «Código inválido».
- [ ] **QR de otra cosa** (un código de WiFi o de una web cualquiera): «Código inválido».
- [ ] **Código manual:** el código de 6 caracteres (en minúsculas también) y el enlace completo pegado encuentran el cupón.
- [ ] **Sin lecturas repetidas:** mantén el celular fijo sobre un QR varios segundos: se consulta una sola vez, sin parpadeos ni resultados duplicados.
- [ ] **Navegadores:** repite los pasos anteriores en Safari (iPhone) y Chrome (Android).
- [ ] **Poca luz:** prueba la linterna si el dispositivo la ofrece.

## 4. Concurrencia con dos dispositivos

- [ ] Abre el **mismo cupón** en el escáner de dos celulares (o un celular y un computador). En ambos aparece «Listo para entregar».
- [ ] Pulsa «Sí, entregar» en los dos casi a la vez: uno obtiene «Entrega registrada» y el otro «Este cupón ya había sido entregado». En el panel el pedido figura entregado una sola vez.

## 5. Seguridad con otra cuenta

- [ ] Crea en Supabase un usuario que **no** esté en `admin_profiles` e inicia sesión con él: aparece «Sin autorización» y no se ve ningún dato.
- [ ] Confirma que nadie puede registrarse solo: no existe ninguna pantalla de registro y Supabase tiene desactivado «Allow new users to sign up».

## 6. Antes del evento

- [ ] `VITE_PUBLIC_APP_URL` apunta a la URL definitiva y los cupones generados ya la usan.
- [ ] El proyecto de Supabase no está pausado (entra al panel).
- [ ] Hay una exportación CSV de `orders` guardada como respaldo.
- [ ] Probaste el escáner en el **lugar de entrega** (con la señal de datos o WiFi que habrá allí).
- [ ] Borra los pedidos de prueba o anótalos como tales.
