# Arquitectura: MVC con SSR y Patrón PRG

La arquitectura que acabas de describir se llama **MVC (Model-View-Controller) con Server-Side Rendering (SSR)**, y específicamente, el patrón de manejo de formularios se conoce como **Post/Redirect/Get (PRG)**.

---

## 🏛️ Desglose de la Arquitectura

### 1. MVC (Model-View-Controller)

Esta es la base de tu diseño y define cómo se organiza tu código en tres responsabilidades clave:

* **Modelo (Model - *Prisma*):** Se encarga de la **lógica de datos** y la **interacción con la base de datos** (DB).
* **Vista (View - *Handlebars*):** Se encarga de la **interfaz de usuario**. El servidor la genera y envía el HTML final al navegador.
* **Controlador (Controller - *Express/TS*):** Actúa como **intermediario**, manejando la lógica de la aplicación y coordinando entre el Modelo y la Vista.

---

### 2. SSR (Server-Side Rendering)

Esta parte define **dónde** se produce el HTML:

* **Server-Side Rendering:** Significa que el **servidor (Node.js/Express)** es el responsable de tomar la plantilla (*Handlebars*), inyectarle los datos y generar la **cadena de texto HTML completa**. El navegador simplemente recibe este HTML ya listo y lo muestra. Esto se opone al CSR (Client-Side Rendering), donde el servidor solo envía un HTML básico y el navegador ejecuta JavaScript para construir la página.

---

### 3. PRG (Post/Redirect/Get)

Este es el patrón de diseño de interacción que utilizas para manejar los envíos de formularios de manera segura y eficiente:

* **Post/Redirect/Get:** Es un patrón que soluciona el problema de que el usuario envíe un formulario dos veces (lo que sucede si recarga la página de confirmación).

    1.  El navegador hace un **POST** al controlador para guardar datos.
    2.  El controlador responde con una **Redirección (Redirect)** (código HTTP 302).
    3.  El navegador hace una nueva solicitud **GET** para mostrar la página actualizada.

---

## Resumen

Estás construyendo una **Aplicación Web MVC tradicional (SSR)** que sigue el patrón **PRG** para sus interacciones con formularios.