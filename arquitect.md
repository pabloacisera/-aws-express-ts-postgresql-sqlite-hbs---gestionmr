# Arquitectura: MVC con SSR y Patrón PRG

La arquitectura que acabas de describir se llama **MVC (Model-View-Controller) con Server-Side Rendering (SSR)**, y específicamente, el patrón de manejo de formularios se conoce como **Post/Redirect/Get (PRG)**.

---

## 🏛️ Desglose de la Arquitectura

### 1. MVC (Model-View-Controller)

Esta es la base de tu diseño y define cómo se organiza el código en tres responsabilidades clave:

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

### 4. Service Layer (Arquitectura de Servicios)
La lógica pesada (como la subida de archivos a la nube) se extrae de los controladores hacia **Servicios dedicados** (`CloudinaryDocService`, `DocumentService`), facilitando las pruebas unitarias y el mantenimiento.

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
| :--- | :--- |
| **Lenguaje** | TypeScript (Compilado a JS para Producción) |
| **Framework Web** | Express.js |
| **Motor de Vistas** | Handlebars (HBS) |
| **Base de Datos** | PostgreSQL (RDS) |
| **ORM** | Prisma |
| **Gestión de Archivos** | Multer |
| **Storage Externo** | Cloudinary (CDN & Storage) |
| **Autenticación** | JWT en Cookies HttpOnly |

---

## ☁️ Infraestructura y Despliegue (AWS Free Tier)

El despliegue está optimizado para funcionar íntegramente en la capa gratuita de AWS, garantizando costo cero para la fase de demo/interna.

* **Servidor (EC2):** Instancia `t3.micro` con Amazon Linux/Ubuntu.
* **Proxy Reverso:** **Nginx** gestiona el tráfico, la terminación SSL, la compresión Gzip y actúa como buffer para las subidas de archivos (hasta 200MB).
* **Base de Datos (RDS):** PostgreSQL gestionado, asegurando backups y alta disponibilidad.
* **Gestión de Procesos:** Actualmente operando con `systemd` para asegurar el reinicio automático del servidor.



---

## 📦 Gestión de Documentos y Archivos

El sistema implementa un flujo de archivos de alta eficiencia que no satura el almacenamiento del servidor:

1.  **Validación en Tiempo Real:** Se aplican límites dinámicos (10MB para imágenes, 20MB para documentos).
2.  **Desacoplamiento:** Los archivos se procesan mediante Multer y se suben directamente a **Cloudinary**.
3.  **Persistencia Híbrida:** Se almacena el `publicId` en PostgreSQL para referenciar los archivos, mientras que el binario vive en el CDN de Cloudinary.
4.  **Visualización Segura:** Las rutas de previsualización y descarga generan redirecciones dinámicas hacia Cloudinary, protegiendo los recursos del servidor.

---

## 📈 Plan de Escalabilidad Progresiva

Para permitir que la aplicación crezca de 10 a cientos de usuarios, se han definido los siguientes pasos de optimización:

### Nivel 1: Optimización de Recursos (Actual)
* **View Caching:** Activación de `app.enable('view cache')` en producción para evitar la recompilación de plantillas HBS.
* **Cluster Mode (PM2):** Migración de `systemd` a PM2 para ejecutar una instancia de la app por cada núcleo de CPU disponible.

### Nivel 2: Infraestructura Gestionada
* **AWS Secrets Manager:** Migración del archivo `.env` hacia un almacén de secretos gestionado.
* **Application Load Balancer (ALB):** Introducción de un balanceador de carga para distribuir el tráfico si se requiere más de una instancia EC2.

### Nivel 3: Almacenamiento y Datos
* **S3 Pre-signed URLs:** En caso de alta demanda de subidas, se implementará la subida directa desde el navegador a S3 para liberar al hilo de Node.js del procesamiento de buffers.

---

## 🛠️ Instalación y Desarrollo

1.  **Clonar repositorio**
2.  **Instalar dependencias:** `npm install`
3.  **Configurar Variables:** Crear un archivo `.env` basado en `.env.example`.
4.  **Generar Cliente Prisma:** `npx prisma generate`
5.  **Compilar:** `npm run build`
6.  **Ejecutar:** `node dist/app.js`


## 🚀 Plan de Acción: Ruta hacia la Escalabilidad Progresiva

Este plan detalla las mejoras técnicas para transformar la demo actual en una aplicación de alta disponibilidad, manteniendo la eficiencia de costos.

### Fase 1: Optimización de Rendimiento (Corto Plazo)
* **Implementación de PM2:** Sustituir `systemd` por el gestor de procesos **PM2**. Esto permitirá activar el *Cluster Mode*, ejecutando una instancia de la app por cada núcleo de la CPU de la EC2, duplicando o triplicando la capacidad de respuesta actual.
* **Cache de Vistas Express:** Forzar la activación de `view cache` en el motor Handlebars para eliminar el tiempo de lectura de disco en cada renderizado.
* **Middleware de Compresión:** Verificar y optimizar Gzip en Nginx para reducir el peso de los archivos estáticos y el HTML renderizado antes de enviarlo al cliente.



### Fase 2: Robustez y Seguridad (Mediano Plazo)
* **Centralización de Secretos:** Migrar las variables del archivo `.env` a **AWS Systems Manager (Parameter Store)**. Esto permite rotar credenciales (DB, Cloudinary, JWT) sin necesidad de tocar el código o el servidor.
* **Offloading de Subidas (S3 Direct Upload):** Modificar el flujo de Multer para usar *Pre-signed URLs*. El cliente subirá los archivos pesados (200MB) directamente a **Amazon S3**, liberando a Node.js de la carga de memoria y ancho de banda que supone procesar binarios grandes.
* **Logging Centralizado:** Implementar un transporte de logs hacia **Amazon CloudWatch** para monitorear errores en tiempo real sin tener que acceder por SSH al servidor.

### Fase 3: Escalabilidad Horizontal (Largo Plazo)
* **Application Load Balancer (ALB):** Introducir un balanceador de carga frente a la instancia EC2. Esto permitirá manejar picos de tráfico distribuyendo la carga entre múltiples servidores.
* **Auto Scaling Groups (ASG):** Configurar reglas automáticas para que AWS levante o termine instancias EC2 basándose en el consumo de CPU o memoria.
* **Base de Datos Desacoplada (Read Replicas):** Configurar réplicas de lectura en RDS PostgreSQL. El tráfico de consultas de reportes (GET) irá a las réplicas, mientras que las escrituras (POST/PATCH) se mantendrán en la instancia primaria.



---

## 🛠️ Checklist de Mejores Prácticas (Producción)
- [ ] **Health Checks:** Crear una ruta `/api/health` para que el Load Balancer verifique el estado del servicio.
- [ ] **Prisma Connection Pool:** Ajustar el límite de conexiones en el DATABASE_URL para no saturar los recursos de la instancia RDS `t3.micro`.
- [ ] **Security Hardening:** Implementar `helmet.js` para añadir cabeceras de seguridad HTTP y prevenir ataques comunes (XSS, Clickjacking).


