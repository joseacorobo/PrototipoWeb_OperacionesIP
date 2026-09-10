# Roadmap, Control de Módulos y Registro de Cambios
## Plataforma de Gestión Operacional y Métricas DERS — Operaciones IP (Inter FTTH)

Este documento es la bitácora oficial del proyecto. Sirve como guía para seguir el estado de cada componente, las decisiones técnicas tomadas, los módulos aprobados y los pasos a seguir sin perder el rumbo del desarrollo.

---

## 1. Estructura y Jerarquía Organizacional del Proyecto

El sistema organiza las áreas técnicas en dos divisiones principales, reflejando la realidad operativa y permitiendo supervisión agregada o granular:

```mermaid
graph TD
    A["DEPARTAMENTO GENERAL: OPERACIONES IP"] --> B["DIVISIÓN: REDES DE ACCESO<br><b>(Alcance Activo FTTH & Infraestructura)</b>"]
    A --> C["DIVISIÓN: SERVICIOS Y CLIENTES<br><b>(Telefonía & Otras Divisiones IP)</b>"]

    B --> B1["Célula de Soporte FTTH"]
    B --> B2["Célula de Cabecera OLT"]

    C --> C1["Célula de Telefonía VoIP / SIP (Operativa)"]
    C --> C2["Grandes Cuentas (Clientes Corporativos / Enlaces Dedicados) [Fase 3]"]
    C --> C3["Redes WAN & Core (Core IP, BGP, Backhaul) [Fase 3]"]
```

> **Nota sobre dotación de personal:** El número de personas por célula y área es **100% variable y dinámico**. La plataforma calcula todas las métricas, promedios y balance de saturación en tiempo real a partir del número de colaboradores activos registrados en base de datos, sin restricciones fijas.

---

## 2. Matriz de Módulos del Sistema

| # | Módulo / Componente | Fase | Estado Actual | Archivos Principales |
| :-: | :--- | :-: | :-: | :--- |
| **M1** | **Motor de Métricas y Puntos DERS** | Fase 1 | **APROBADO** | `app/database.py`, `app/seed.py`, `app/main.py` |
| **M2** | **Workspace FSM y Cronometraje Automático** | Fase 1 | **APROBADO** | `app/templates/dashboard.html`, `app/static/js/dashboard.js` |
| **M3** | **Algoritmo de Extracción Telco (`TelcoEmailParser`)** | Fase 1 | **APROBADO** | `app/services/email_parser.py` |
| **M4** | **Reportes Gerenciales y Auditoría Forense (Excel)** | Fase 1 | **APROBADO** | `app/services/reports.py`, `app/templates/dashboard.html` |
| **M5** | **Asistente Inteligente de Comandos CLI (OLT / 815 / SW)** | Fase 2 | **PAUSADO / EN REGISTRO DE COMANDOS** | `app/services/command_generator.py` *(Estructura lista)* |
| **M6** | **Worker de Ingesta de Correo (IMAP / Background Worker)** | Fase 2 | **APROBADO** | `app/services/mail_worker.py`, `app/templates/dashboard.html`, `app/static/js/dashboard.js` |
| **M7** | **Gestión de Usuarios, Autenticación y Roles RBAC** | Fase 2 | **PLANIFICADO / ESPECIFICADO** | `app/database.py`, `app/main.py` *(Modelo preparado)* |
| **M8** | **Expansión: Grandes Cuentas y Operaciones WAN** | Fase 3 | **PLANIFICADO** | Arquitectura modular extensible |

---

## 3. Detalle de Módulos Implementados (Aprobados)

### Módulo 1: Motor de Métricas y Catálogo DERS
- **Propósito:** Medir la carga real de trabajo de los colaboradores distribuidos por células funcionales bajo el estándar de ponderación DERS.
- **Sistema de Puntos Ponderados:**
  - **P1 (1 pt):** Verificación de estado de ONT en OLT / Consultas simples.
  - **P2 (2 pts):** Resolución de discrepancia MAC / Pruebas de velocidad.
  - **P3 (3 pts):** Desatasco de demonio OLT (VLAN / Whitelist) / Sustitución SFP.
  - **P4 (5 pts):** Soporte a Modo Bridge con IP Certificada / Diagnóstico Jitter & MOS VoIP.
  - **P5 (8 pts):** Habilitación PortChannel 10G -> 20G / Contingencias troncales.
- **Velocímetro de Balance:** Categorización dinámica de saturación promedio por especialista activo (<=25 pts: *Equilibrada*, 26-45 pts: *Moderada*, >45 pts: *Alta / Alerta*).

### Módulo 2: Workspace de Atención y Cronometraje Automatizado
- **Propósito:** Brindar al técnico un espacio de trabajo único por ticket y eliminar al 100% el ingreso manual de tiempos.
- **Flujo FSM:**
  - `PENDIENTE` -> `EN PROGRESO` (al pulsar *Atender*, se bloquea con avatar/nombre del técnico para evitar trabajo duplicado y se inicia cronómetro en backend con `claimed_at = now()`).
  - `EN PROGRESO` -> `EN ESPERA` (botón de pausa cuando se espera respuesta de cuadrilla en terreno o verificación física de acometida; el tiempo pausado no penaliza el MTTR).
  - `EN PROGRESO` -> `COMPLETADO` (al pulsar *Resolver*, el sistema calcula de forma 100% automática `(now - claimed_at) - tiempo_pausado`, acredita los puntos y actualiza el dashboard).

### Módulo 3: Algoritmo de Extracción Telco (`TelcoEmailParser`)
- **Propósito:** Extraer entidades técnicas clave desde correos desestructurados en texto libre enviados por cuadrillas o NOC.
- **Sintaxis Oficial de Inter Integrada:**
  - **Abonado (10 dígitos exactos):** Soporta etiquetas `AB`, `AB:`, `Abonado:`, `Contrato:`, y extrae los 2 primeros dígitos como identificador de **Permisor** (ej. `P-10`, `P-25`).
  - **Serial PON (12 caracteres):** Reconocimiento de prefijos de red:
    - `FHTTXXXXXXXX` -> FiberHome (Red Inter)
    - `HWTCXXXXXXXX` -> Huawei (Red Netuno)
    - `STVXXXXXXXXX` / Otros -> SimpleTV / Terceros
  - **Nombre Canónico de OLT:** Normaliza variantes como `OLT CHAC 01` o `OLT VAL 02` a `OLT-CHAC-01` o `OLT-VAL-02`.
  - **Ubicación en OLT:** Asigna inteligentemente *"Consultar en OLT vía Serial PON"*.
  - **Detección Heurística de Modo Bridge / IP Certificada:** Si detecta términos de bridge o IP fija, enciende de forma obligatoria la **alerta en rojo de prohibición de refresh o reaprovisionamiento**.
- **Probador Interactivo en UI:** Botón *Analizar Caso Real* en el header para pegar texto libre y observar la distribución instantánea en casillas.

### Módulo 4: Reportes Gerenciales y Auditoría Forense (Excel)
- **Propósito:** Facilitar la toma de decisiones gerenciales, balance de turnos y trazabilidad forense ticket por ticket.
- **Panel Web Interactivo:** Filtros por período (*Hoy, Últimos 7d, Mes Actual, Todo*) y célula/división (*Todas las Áreas, Redes de Acceso, Soporte FTTH, Cabecera OLT, Telefonía VoIP*).
- **Exportación en 1 Clic a Excel (`.xlsx`):** Genera mediante `openpyxl` un libro con 3 hojas profesionales:
  1. *Resumen Ejecutivo y Células:* KPIs consolidados, horas de trabajo, % de participación de cada célula y semáforo de saturación.
  2. *Productividad Especialistas:* Detalle de todos los analistas activos con volumen de tickets, puntos totales, MTTR y desglose de tareas P1 a P5.
  3. *Log Detallado de Auditoría:* Trazabilidad completa con fechas, tiempos netos y pausas, datos de red (Abonado, Permisor, Serial, OLT, MAC) y notas de diagnóstico del operador.

### Módulo 6: Worker de Ingesta Real de Correos en Segundo Plano
- **Propósito:** Automatización completa de la ingesta de casos hacia la bandeja de correos FSM sin intervención humana.
- **Doble Modalidad de Operación:**
  1. **Modo Simulador de Laboratorio:** Genera casos sintéticos de soporte FTTH, cabecera OLT y telefonía VoIP respetando 100% los estándares de seriales FiberHome/Huawei, contratos de 10 dígitos y OLTs canónicas. Permite probar el sistema localmente sin conexión a internet ni requerir credenciales externas.
  2. **Modo IMAP SSL Real:** Conexión segura al servidor IMAP (`imaplib` con SSL por puerto 993), lectura de mensajes no leídos (`UNREAD`), extracción de cuerpo de texto plano / HTML multipart, marcado `\Seen` y extracción determinista con `TelcoEmailParser`.
- **Mecanismo Antiduplicidad:** Registro de `Message-ID` (RFC 2822) con índice único en SQLite (`idx_email_tickets_msgid`), garantizando idempotencia absoluta.
- **Control y Telemetría en Frontend:** Barra de telemetría (modo, estado activo/pausado, última sincronización e ingestados acumulados), botones de sincronización forzada y modal de configuración.

---

## 4. Módulo 7: Gestión de Acceso, Autenticación y Roles RBAC (Planificado)

Este módulo se desarrollará para permitir el control de sesiones seguras y la asignación de permisos según el perfil funcional:

### Arquitectura y Especificación Funcional:

1. **Registro de Usuarios (`/api/auth/register`):**
   - Formulario de registro corporativo restringido a correos institucionales (`@inter.com.ve`).
   - Asignación de división y célula (`Redes de Acceso -> Soporte FTTH / Cabecera OLT`, `Servicios -> Telefonía VoIP`).
   - Almacenamiento seguro de contraseñas con funciones de dispersión criptográfica (hash seguro).

2. **Inicio de Sesión (`/api/auth/login`):**
   - Validación de credenciales contra la tabla `users`.
   - Generación de token de sesión / Cookie segura.
   - Menú de perfil en la esquina inferior izquierda con avatar, rol y botón de *Cerrar Sesión* (`Logout`).

3. **Matriz de Roles Estándar (RBAC):**
   - **Especialista / Operador:**
     - Atención de tickets en bandeja FSM correspondiente a su célula.
     - Uso de cronómetro en vivo y resolución automatizada de tickets.
     - Visualización de sus métricas individuales de puntos y MTTR.
   - **Coordinador:**
     - Supervisión táctica de la división asignada (ej. *Redes de Acceso* completa).
     - Capacidad de reasignar tickets entre especialistas o levantar pausas prolongadas.
     - Monitoreo en vivo del balance de saturación de su equipo.
     - Acceso al modal de reportes ejecutivos y descarga de Excel.
   - **Administrador:**
     - Control global de la plataforma.
     - Gestión de usuarios (alta, baja, cambio de rol o célula).
     - Configuración de buzones IMAP y parámetros del worker.
     - Ajuste del catálogo de tareas DERS y ponderación de puntos.
     - Auditoría forense integral de operaciones.

4. **Base de Datos Preparada:**
   - La tabla `users` ya cuenta con los campos `email TEXT UNIQUE`, `password_hash TEXT`, `role TEXT` y `created_at TIMESTAMP`.
   - Endpoint activo `GET /api/users` para listar usuarios dinámicamente.
   - Endpoint activo `GET /api/auth/me` para resolver el perfil de sesión.

---

## 5. Módulo 5: Asistente Inteligente de Comandos CLI (Pausado para Registro)

Este módulo queda en espera de que el usuario consolide y registre la lista oficial de comandos operativos:

### Alcance a Implementar:
1. **Catálogo por Fabricante:**
   - **FiberHome (AN5516 / AN5116):** `show card`, `show pon power`, desatasco de demonio y consulta Whitelist.
   - **Huawei (MA5608T / MA5800):** `display ont info`, `display ont optical-info`.
   - **Servidor 815 (Gx):** Consulta de WANMAC y verificación de sesiones PPPoE/IPoE.
2. **Autocompletado Contextual:** Al abrir el ticket, los comandos se prellenan con el Slot, PON y Serial del caso.
3. **Barrera de Seguridad:** Bloqueo preventivo de comandos de reinicio o refresh si el ticket está marcado como Modo Bridge con IP Certificada.

---

## 6. Registro Cronológico de Versiones (Changelog)

- **v0.1 (2026-09-04):** Análisis de documentación base (`Capacitacion FTTH.pptx`, `EsquemaOLT_SW_815_FTTH_General v2.pptx`).
- **v0.2 (2026-09-04):** Diseño del catálogo de tareas DERS (20 tipos), matriz Excel inicial y base de datos SQLite.
- **v0.3 (2026-09-09):** Construcción del Dashboard frontend con diseño SnowUI, gráficos Chart.js y navegación por células.
- **v0.4 (2026-09-09):** Creación del Workspace Modal de tickets con cronómetro en vivo (`HH:MM:SS`), botón de pausa y cálculo de MTTR neto automatizado.
- **v0.5 (2026-09-09):** Creación del servicio `TelcoEmailParser` con soporte a abonados de 10 dígitos, detección de Permisor, seriales de 12 caracteres (Inter / Netuno / SimpleTV), OLTs canónicas y botón interactivo *Analizar Caso Real*.
- **v0.6 (2026-09-09):** Desarrollo del Módulo de Reportes Gerenciales con exportación a Excel en 3 hojas (`openpyxl`).
- **v0.7 (2026-09-09):** Publicación inicial en GitHub: `joseacorobo/PrototipoWeb_OperacionesIP`.
- **v0.8 (2026-09-09):** Creación de la bitácora oficial (`ROADMAP_Y_CONTROL_MODULOS.md`).
- **v0.9 (2026-09-09):** Especificación arquitectónica del Worker de Ingesta Multi-Buzón.
- **v1.0 (2026-09-09):** Implementación integral del Módulo 6 (Worker de Ingesta IMAP / Simulador). Eliminación estricta de emojis decorativos en todo el sistema.
- **v1.1 (2026-09-09):** Reorganización de categorías departamentales: creación de la categoría general **Redes de Acceso** (agrupando Soporte FTTH y Cabecera OLT) y **Servicios & Clientes** (Telefonía VoIP, Grandes Cuentas y WAN Core). Eliminación total de valores fijos de dotación de personal (el conteo de especialistas ahora es 100% dinámico). Diseño y especificación del **Módulo 7: Autenticación, Registro y Roles RBAC (Administrador, Coordinador, Especialista)** con migración de base de datos aplicada.
- **v1.2 (2026-09-10):** Implementación integral del **Modo Oscuro Simultáneo (SnowUI Dark Theme)** nativo con paleta pizarra/obsidiana (`#0B0E14` / `#151924` / `#202637`), selector Sol/Luna con persistencia en `localStorage` y adaptación reactiva de Chart.js. Incorporación de arquitectura **Escalable y Resistente ante Zoom (50% a 200%) y Minimizado de Ventana**, integrando botones protegidos contra compresión (`shrink-0`, `whitespace-nowrap`), pastillas con desplazamiento horizontal suave (`no-scrollbar`), sidebar replegable con botón hamburguesa para pantallas compactas y grillas fluidas de tarjetas KPI.

---

*Última actualización: 2026-09-10 09:15*\n