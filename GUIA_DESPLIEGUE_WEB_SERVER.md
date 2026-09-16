# Guía Oficial de Despliegue en Servidor Web de Pruebas Continuo
## Prototipo de Operaciones IP & Ingeniería Inter

Esta guía describe los métodos para publicar y mantener en funcionamiento continuo el prototipo web para que pueda ser visualizado, evaluado y utilizado permanentemente por el equipo técnico, coordinadores y la gerencia.

---

## Opción 1: Despliegue Gratuito en la Nube (Render.com) - Recomendado

Esta opción es 100% automática, gratuita y no requiere gestionar servidores físicos ni abrir puertos en routers. Se sincroniza directamente con el repositorio en GitHub:
`https://github.com/joseacorobo/PrototipoWeb_OperacionesIP.git`

### Pasos para Activar en 3 Minutos:

1. **Crear o iniciar sesión en Render:**
   - Ingrese a [https://render.com](https://render.com) y cree una cuenta (puede iniciar sesión directamente con su cuenta de GitHub).

2. **Crear un Nuevo Web Service:**
   - En el panel principal, haga clic en el botón **"New +"** y seleccione **"Web Service"**.
   - Conecte su cuenta de GitHub y seleccione el repositorio:
     `joseacorobo/PrototipoWeb_OperacionesIP`

3. **Configurar los Parámetros del Servicio:**
   - **Name:** `inter-operaciones-ip` (o el nombre que prefiera).
   - **Region:** Ohio (US East) o Frankfurt.
   - **Branch:** `main`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan Type:** `Free`

4. **Variables de Entorno (Environment Variables):**
   - Agregue la variable:
     - `PYTHON_VERSION` = `3.11.0`

5. **Lanzar el Despliegue:**
   - Haga clic en **"Create Web Service"**.
   - Render construirá la imagen, instalará dependencias y ejecutará el servidor.
   - En aproximadamente 2 minutos, obtendrá una URL pública segura HTTPS del tipo:
     `https://inter-operaciones-ip.onrender.com`
   - Cada vez que hagamos `git push origin main`, Render actualizará el sitio automáticamente sin intervención manual.

---

## Opción 2: Despliegue en Servidor Dedicado / VPS con Docker

Si dispone de un servidor Linux (Ubuntu/Debian) o un servidor Windows con Docker instalado en la red de la empresa o en la nube (AWS, DigitalOcean, Hetzner, etc.):

### Pasos:

1. **Clonar el repositorio en el servidor:**
   ```bash
   git clone https://github.com/joseacorobo/PrototipoWeb_OperacionesIP.git
   cd PrototipoWeb_OperacionesIP
   ```

2. **Iniciar el contenedor con Docker Compose:**
   ```bash
   docker compose up -d --build
   ```

3. **Verificar estado:**
   ```bash
   docker compose ps
   docker compose logs -f operaciones-ip-web
   ```

4. **Acceso:**
   - El servicio estará disponible inmediatamente en:
     `http://<IP_DEL_SERVIDOR>:8000`
   - Los datos de la base de datos (`ip_ops.db`) y los archivos adjuntos se mantienen persistentes en el disco del host.

---

## Opción 3: Despliegue en Servidor Local / Windows Server como Servicio Continuo

Para ejecutar el prototipo de forma nativa en un servidor con Python 3.10+ sin Docker:

1. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Iniciar el servidor web:**
   ```bash
   python server.py
   ```
   *El servidor detecta automáticamente el puerto configurado en la variable `PORT` (por defecto `8000`) y se enlaza a `0.0.0.0` para aceptar conexiones de cualquier equipo de la red local o externa.*

3. **Acceso desde otros equipos de la red:**
   - Abra el puerto 8000 en el Firewall de Windows si es necesario.
   - Desde cualquier navegador de la red: `http://<IP_DE_LA_MAQUINA>:8000`

---

## Opción 4: Compartir URL Pública Inmediata sin Configurar Servidor (Cloudflare Tunnel)

Si desea que otra persona visualice el prototipo que está corriendo en su máquina en este momento sin desplegar en la nube:

1. **Descargar Cloudflare Tunnel (`cloudflared`):**
   - Ejecutar en terminal:
     ```bash
     cloudflared tunnel --url http://localhost:8000
     ```
   - Cloudflare generará una URL pública gratuita y segura (ejemplo: `https://rapid-testing-inter.trycloudflare.com`) válida para cualquier usuario en internet.

---

## Credenciales de Acceso para el Web Server

Cualquier usuario creado o inicializado en el sistema puede autenticarse con la contraseña predeterminada:
- **Contraseña universal de prueba:** `inter2026`
- **Contraseña del Especialista José Corobo:** `admin`

### Perfiles de Prueba Principales:
| Nombre | Correo | Rol | Área | Contraseña |
| :--- | :--- | :--- | :--- | :--- |
| **José Corobo** | `joseacorobo@gmail.com` | Especialista | Soporte | `admin` |
| **Carlos Méndez** | `carlos.mendez@inter.com.ve` | Coordinador | Soporte | `inter2026` |
| **Luis Gómez** | `luis.gomez@inter.com.ve` | Coordinador | Cabecera | `inter2026` |
| **Daniela Castillo** | `daniela.castillo@inter.com.ve` | Coordinador | Telefonía | `inter2026` |
| **David Rodríguez** | `david.rodriguez@inter.com.ve` | Administrador | Acceso | `inter2026` |
| **Administrador General** | `admin@inter.com.ve` | Administrador | Todas | `inter2026` |

---

## Monitoreo y Verificación de Salud del Web Server

El servidor expone rutas de diagnóstico para balanceadores o monitores de uptime:
- **Resumen de Métricas:** `GET /api/kpis` (Retorna 200 OK y JSON de métricas)
- **Estado del Worker de Correo:** `GET /api/mail-worker/status`
- **Bitácora de Auditoría Forense:** `GET /api/audit/logs`
