# Sistema de Gestión y Registro de Personas (Express MVC + Supabase + TailwindCSS + JWT + OWASP)

Aplicación web empresarial desarrollada bajo el patrón arquitectónico **MVC (Modelo - Vista - Controlador)** con **Express.js**, **Supabase** (PostgreSQL), **TailwindCSS**, autenticación mediante **JSON Web Tokens (JWT)** y estándares de seguridad web **OWASP**.

---

## 🚀 Características Principales

1. **Autenticación Segura (Login Admin)**:
   - Autenticación con JWT firmado.
   - Almacenamiento en cookie `HttpOnly`, `SameSite: Lax` y `Secure` (en producción), mitigando ataques XSS.
   - Protección contra fuerza bruta con **Rate Limiting** estricto (`express-rate-limit`).
   - Contraseñas protegidas mediante **bcrypt** (12 salt rounds).

2. **Dashboard de Métricas & KPIs**:
   - Total de personas registradas.
   - Estado de la base: personas activas vs inactivas.
   - **Segmentación por Sexo**: Gráfico interactivo tipo dona (Masculino, Femenino, Otro) usando Chart.js.
   - **Segmentación por Sector**: Gráfico de barras horizontales con el top de sectores con mayor cobertura.
   - Tabla de registros recientes con acceso directo a detalles.
   - Botón interactivo para copiar el enlace público de registro con 1 clic.

3. **Módulo de Personas Registradas**:
   - Listado tabular con filtros simultáneos por término de búsqueda, sector, sexo y estado (activo/inactivo).
   - Acciones por persona:
     - **Visualizar Detalle**: Vista completa con datos descifrados para el administrador y auditoría criptográfica.
     - **Editar**: Formulario de actualización con recifrado automático.
     - **Inactivar / Activar**: Botón de alternancia de estado (soft status) con confirmación.
   - Formulario administrativo de nuevo registro.

4. **Link Público de Registro (Sin Login)**:
   - URL pública: `/registro`.
   - Permite a cualquier ciudadano registrar sus datos sin iniciar sesión.
   - Protegido con Rate Limiting anti-spam y validación estricta.
   - Mensaje de confirmación en `/registro/exito`.

5. **Módulo de Boletines Informativos (Email y WhatsApp)**:
   - Envío masivo a personas activas.
   - Canales disponibles:
     - **Correo Electrónico**: Plantilla HTML responsive despachada vía Nodemailer / SMTP.
     - **WhatsApp**: Generación de cola de enlaces automáticos (`https://api.whatsapp.com/send?phone=...&text=...`) personalizados con el nombre y mensaje de cada destinatario.
     - **Ambos Canales**: Despacho conjunto.
   - Historial persistente de boletines enviados.

6. **Módulo de Colegios Electorales**:
   - URL: `/colegios`.
   - Listado tabular con KPIs (Total Colegios, Activos, Mesas Electorales y Padrón Estimado).
   - Filtros por búsqueda de texto, municipio, sector y estado.
   - Registro de nuevos recintos electorales (`/colegios/nuevo`) con validación de código único.
   - Alternancia de estado Activo/Inactivo por colegio.

---

## 🔒 Arquitectura Criptográfica y Seguridad OWASP

### Cifrado en Reposo vs. Visualización Administrativa
Para cumplir con el requerimiento de que la Cédula, Teléfono y Correo Electrónico estén protegidos en la base de datos pero que el Administrador pueda visualizarlos en el listado y detalle, se implementó una arquitectura de **Cifrado Autenticado de Grado Militar**:

1. **AES-256-GCM (Authenticated Encryption)**:
   - Cada campo sensible (`cedula`, `telefono`, `email`) se cifra individualmente antes de guardarse en la base de datos.
   - Se utiliza un Vector de Inicialización (IV) criptográficamente seguro de 16 bytes y un Tag de Autenticación de 16 bytes para prevenir manipulación.
   - En la base de datos solo se guardan cadenas opacas `iv:tag:ciphertext`.
2. **Blind Index Hash (HMAC-SHA-256)**:
   - Para permitir validar unicidad de cédula y realizar búsquedas indexadas sin descifrar toda la base de datos, se almacena un hash determinístico HMAC protegido por la clave `HASH_SECRET`.
3. **Descifrado en Memoria Restringido a Administradores**:
   - Solo cuando una petición llega con un JWT verificado emitido a un administrador activo, el backend descifra los campos en memoria para presentarlos en las vistas.
4. **Otras Mitigaciones OWASP Implementadas**:
   - **OWASP A01 (Broken Access Control)**: Middleware `requireAuth` protegiendo todas las rutas administrativas.
   - **OWASP A03 (Injection)**: Sanitización y validación estricta con `express-validator` para formatos de cédula, teléfono y email.
   - **OWASP A05 (Security Misconfiguration)**: Headers HTTP seguros con `helmet` (CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff).
   - **OWASP A07 (Identification & Authentication Failures)**: Rate limiting estricto para login y cookies HttpOnly.

---

## 🛠️ Instalación y Puesta en Marcha

### 1. Clonar o entrar al directorio del proyecto:
```bash
cd "C:\Users\Andre\.gemini\antigravity\scratch\registro-personas-mvc"
```

### 2. Instalar dependencias (si no se han instalado):
```bash
npm install
```

### 3. Configurar Variables de Entorno:
Revisa o edita el archivo `.env`:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=super_secret_jwt_key_min_32_characters_long_123456!
ENCRYPTION_KEY=a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90
HASH_SECRET=secure_blind_index_salt_hmac_secret_2026!

# Supabase (Opcional - Si se dejan vacías, la app arranca con el almacenamiento local persistente)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### 4. Conexión con Supabase (Opcional pero recomendado para producción):
1. Inicia sesión en [Supabase](https://supabase.com) y crea un nuevo proyecto.
2. Abre el **SQL Editor** en tu panel de Supabase.
3. Copia y pega el contenido del archivo `supabase_schema.sql` y presiona **Run**.
4. Copia tu `Project URL` y `Service Role Key` (en Settings -> API) en el archivo `.env`.

### 5. Compilar Estilos CSS (TailwindCSS local):
El CSS ya se encuentra precompilado y optimizado en `src/public/css/tailwind.css`. Si realizas cambios en clases de Tailwind en las vistas, puedes compilar o vigilar cambios con:
```bash
npm run build:css   # Compilación y minificación de producción
npm run watch:css   # Vigilancia y compilación automática en vivo
```

### 6. Iniciar la Aplicación:
```bash
npm start
```
O en modo de desarrollo con recarga automática:
```bash
npm run dev
```

---

## 🔑 Credenciales Iniciales de Administrador

- **URL de Login:** `http://localhost:3000/auth/login`
- **Correo Electrónico:** `admin@registropersonas.com`
- **Contraseña:** `Admin12345!*`

*(Estas credenciales son generadas automáticamente por el seeder en el primer inicio).*

---

## 🌐 Enlace Público de Registro
- **URL Compartible:** `http://localhost:3000/registro`
Cualquier persona puede ingresar directamente a este enlace para registrar sus datos sin necesidad de usuario ni contraseña.
