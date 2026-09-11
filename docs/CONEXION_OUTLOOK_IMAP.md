# Guia de Conexion del Modulo de Correo: Outlook / Exchange e IMAP Seguro

Esta documentacion describe la arquitectura, protocolos de cifrado y procedimientos de configuracion para conectar la plataforma de **Operaciones IP (Inter Telecomunicaciones)** con buzones de correo corporativos basados en **Microsoft Outlook / Office 365, Exchange y servidores IMAP**.

---

## 1. Protocolos de Comunicacion y Cifrado

El modulo de ingesta automatica opera bajo estándares de seguridad en telecomunicaciones para garantizar la integridad y confidencialidad del trafico de red:

| Parametro | Especificacion Tecnica |
| :--- | :--- |
| **Protocolo** | IMAP4 (Internet Message Access Protocol version 4rev1 - RFC 3501) |
| **Capa de Transporte** | TCP / SSL-TLS Implicito |
| **Puerto Estandar** | `993` (seguro) |
| **Cifrado Negociado** | TLS 1.2 o TLS 1.3 con `ssl.create_default_context()` |
| **Autenticacion** | SASL Plain / Login sobre canal cifrado TLS |
| **Deduplicacion** | Indice unico en SQLite basado en cabecera `Message-ID` (RFC 822/2822) |
| **Marcado de Estado** | Marcado automatico de correos leidos con flag `\Seen` en el servidor |

---

## 2. Configuracion por Tipo de Servidor

### A. Microsoft 365 / Outlook Corporativo
Para cuentas corporativas bajo el dominio Microsoft 365 (`usuario@empresa.com` u `@inter.com.ve` en O365):
- **Servidor IMAP:** `outlook.office365.com`
- **Puerto:** `993`
- **Seguridad:** SSL/TLS
- **Buzon Principal:** `INBOX`

> **Nota sobre Doble Factor de Autenticacion (2FA / MFA):**
> Si la organizacion tiene habilitada la autenticacion multifactor (Microsoft Authenticator o SMS), no se debe utilizar la contrasena normal del usuario. Es necesario generar una **Contrasena de Aplicacion**:
> 1. Iniciar sesion en [https://myaccount.microsoft.com/](https://myaccount.microsoft.com/).
> 2. Ir a **Informacion de Seguridad** -> **Agregar metodo**.
> 3. Seleccionar **Contrasena de aplicacion**.
> 4. Copiar la clave de 16 caracteres generada e introducirla en el campo de contrasena del modulo.

### B. Servidor Exchange On-Premise / Webmail Inter
Para servidores locales de correo corporativo de Inter:
- **Servidor IMAP:** `mail.inter.com.ve` o `imap.inter.com.ve`
- **Puerto:** `993`
- **Seguridad:** SSL/TLS
- **Usuario:** Correo completo (ej. `operaciones.ip@inter.com.ve`)
- **Buzon:** `INBOX`

### C. Google Workspace / Gmail Corporativo
- **Servidor IMAP:** `imap.gmail.com`
- **Puerto:** `993`
- **Seguridad:** SSL/TLS
- Requiere activar una **Contrasena de Aplicacion** desde la seccion de Seguridad de la Cuenta Google.

---

## 3. Procedimiento de Conexion y Prueba en Vivo

La plataforma incluye una herramienta de diagnostico en tiempo real:

1. Ingresar a la **Bandeja de Correos FSM**.
2. En la barra superior, hacer clic en el icono de **Configuracion** (tuerca).
3. Seleccionar la modalidad **Buzon IMAP Real SSL (Puerto 993)**.
4. Completar los campos:
   - **Servidor IMAP Host:** (ej. `outlook.office365.com` o `mail.inter.com.ve`).
   - **Puerto:** `993`.
   - **Usuario / Correo:** Dirección de correo de soporte.
   - **Contrasena:** Contrasena corporativa o de aplicacion.
   - **Buzon / Carpeta:** `INBOX`.
5. Presionar el boton **Probar Conexion**:
   - El sistema ejecutara una validacion de handshake SSL/TLS y autenticacion.
   - Si la conexion es exitosa, indicara la latencia en milisegundos (`ms`), la version de TLS negociada y el numero de correos no leidos disponibles.
   - Si existe algun fallo, desplegara el diagnostico exacto (Fallo de DNS, Error de autenticacion o Puerto bloqueado).
6. Presionar **Guardar y Aplicar**.
7. Presionar el boton **Sincronizar ahora** (icono de refresco) para forzar la primera ingesta inmediata de tickets.

---

## 4. Resolucion de Problemas Frecuentes

### 1. `NO [AUTHENTICATIONFAILED] Invalid credentials`
- **Causa:** La cuenta tiene autenticacion multifactor (2FA) o politicas de acceso condicional activas.
- **Solucion:** Generar una Contrasena de Aplicacion de 16 caracteres en el portal de Microsoft o Google.

### 2. `Connection timed out` o `Timeout de conexion`
- **Causa:** El puerto saliente `993` esta bloqueado por el firewall de la estacion de trabajo o la red local.
- **Solucion:** Verificar conectividad por PowerShell ejecutando:
  ```powershell
  Test-NetConnection -ComputerName outlook.office365.com -Port 993
  ```
  Debe retornar `TcpTestSucceeded : True`.

### 3. `CERTIFICATE_VERIFY_FAILED`
- **Causa:** El servidor utiliza certificados autofirmados o la cadena de confianza CA no esta instalada en el sistema operativo.
- **Solucion:** Asegurar que los certificados raiz de la entidad emisora (ej. DigiCert, Let's Encrypt o CA interna de Inter) esten instalados en el almacen de certificados del equipo.

---

## 5. Arquitectura del Ingestor de Tareas

```
[ Servidor Outlook / Exchange ]
              |  (Puerto 993 SSL / TLS 1.3)
              v
     [ MailWorker Service ]
              |  1. Extraccion RFC822
              |  2. Deduplicacion Message-ID
              v
    [ TelcoEmailParser NLP ]
              |  - Identifica Abonado (10 digitos) y Permisor
              |  - Extrae Serial PON (FHTT, HWTC, ZTEG)
              |  - Localiza OLT (OLT-CHAC-01) y Slot/PON
              |  - Detecta Modo Bridge / IP Certificada (P4)
              |  - Detecta Averias SIP / VoIP (P3)
              v
    [ Base de Datos SQLite (email_tickets) ]
              |  Status: 'PENDIENTE'
              v
    [ Bandeja FSM de Operaciones IP ]
```
