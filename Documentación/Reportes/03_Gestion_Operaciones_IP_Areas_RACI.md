# Gestión del Flujo FTTH — Departamento de Operaciones IP

## 1. Estructura Organizacional

```mermaid
flowchart TB
    subgraph OPS_IP["🏢 DEPARTAMENTO DE OPERACIONES IP (12 personas)"]
        direction TB
        JEFE["Jefatura / Coordinación\nOperaciones IP"]

        subgraph SOPORTE["🛠️ SOPORTE DE OPERACIONES (4 personas)"]
            S1["Técnico Soporte 1"]
            S2["Técnico Soporte 2"]
            S3["Técnico Soporte 3"]
            S4["Técnico Soporte 4"]
        end

        subgraph CABECERA["📡 CABECERA / HEAD END (4 personas)"]
            C1["Técnico Cabecera 1"]
            C2["Técnico Cabecera 2"]
            C3["Técnico Cabecera 3"]
            C4["Técnico Cabecera 4"]
        end

        subgraph TELEFONIA["📞 TELEFONÍA (4 personas)"]
            T1["Técnico Telefonía 1"]
            T2["Técnico Telefonía 2"]
            T3["Técnico Telefonía 3"]
            T4["Técnico Telefonía 4"]
        end

        JEFE --> SOPORTE
        JEFE --> CABECERA
        JEFE --> TELEFONIA
    end

    style JEFE fill:#0d6efd,color:#fff
    style SOPORTE fill:#dc354522,stroke:#dc3545
    style CABECERA fill:#fd7e1422,stroke:#fd7e14
    style TELEFONIA fill:#19875422,stroke:#198754
```

---

## 2. Alcance de Cada Área dentro del Flujo FTTH

```mermaid
flowchart LR
    subgraph FLUJO["FLUJO DE DATOS FTTH"]
        direction LR
        ONT["ONT\nFiberHome"]
        SPLITTERS["Splitters\n1:16 / 1:4 / 1:2"]
        EDFA["EDFA"]
        OLT["OLT"]
        SW["Switch"]
        SRV["Servidor\n815"]
        UPSTREAM["Sw Netuno\nInternet"]
    end

    ONT --> SPLITTERS --> EDFA --> OLT --> SW --> SRV --> UPSTREAM

    subgraph ZONAS["ZONAS DE RESPONSABILIDAD"]
        direction TB
        Z_SOP["🛠️ SOPORTE\nMonitoreo + Diagnóstico\nde extremo a extremo"]
        Z_CAB["📡 CABECERA\nHardware físico\nOLT + Switch + 815"]
        Z_TEL["📞 TELEFONÍA\nRegistro SIP\nServicios de voz"]
    end

    Z_SOP -.->|"Monitorea"| ONT
    Z_SOP -.->|"Diagnostica"| OLT
    Z_SOP -.->|"Verifica"| SRV
    Z_CAB -.->|"Instala/Mantiene"| EDFA
    Z_CAB -.->|"Configura HW"| OLT
    Z_CAB -.->|"Conecta"| SW
    Z_CAB -.->|"Setup físico"| SRV
    Z_TEL -.->|"Registro SIP"| OLT
    Z_TEL -.->|"Servicios voz"| SRV

    style Z_SOP fill:#dc3545,color:#fff
    style Z_CAB fill:#fd7e14,color:#fff
    style Z_TEL fill:#198754,color:#fff
    style SW fill:#ffc107,color:#000
```

---

## 3. Responsabilidades Detalladas por Área

### 🛠️ Área de Soporte de Operaciones (4 personas)

**Rol principal**: Monitoreo, diagnóstico y resolución de incidencias en la red FTTH desde la capa lógica.

| Función | Detalle |
|---------|---------|
| **Monitoreo de estados ONU** | Verificar Discovery, Whitelist, Aprovisionada, MAC Verde/Roja |
| **Diagnóstico de conectividad** | Identificar si la ONU está en "No encontrada", estados intermedios |
| **Verificación en Servidor 815** | Confirmar que la conexión se creó, IP asignada, WANMAC correcto |
| **Pruebas de velocidad** | Ejecutar por CLI contra Speedtest INTER, aislando la red del abonado |
| **Verificación de potencia** | Validar valores TX/RX de la ONU (dentro de umbrales) |
| **Soporte FibraHogar** | Consultar estado de ONU, verificar si está encendida |
| **Escalamiento** | Escalar a SISTEMAS si el demonio falla, a Planta Externa si hay problema óptico |
| **Coordinación con ARU** | Guiar al técnico de campo en procedimientos de troubleshooting |

> [!IMPORTANT]
> **Lo que Soporte NO hace:**
> - No administra los demonios de aprovisionamiento (es SISTEMAS)
> - No resuelve problemas de potencia óptica (es Planta Externa/ARU)
> - No reaprovisionan ni envían REFRESH a ONUs en modo BRIDGE

---

### 📡 Área de Cabecera / Head End (4 personas)

**Rol principal**: Instalación, configuración física y mantenimiento del hardware en el Head End.

| Función | Detalle |
|---------|---------|
| **Instalación de OLT** | Rack, energía, tarjetas de abonados (slots 1-8, 11-18), controladora (9-10) |
| **Conexión OLT ↔ Switch** | Instalar módulos XFP-10G-SR (OLT) y SFP-10G-SR (Switch), patch cords |
| **PortChannel OLT** | Ampliar capacidad de 10G a 20G conectando segundo enlace |
| **Setup Servidor 815** | Instalación física, conexión puertos WAN/LAN/Gestión |
| **PortChannel 815** | Ampliar capacidad WAN de 10G a 20G |
| **EDFA** | Instalación y mantenimiento del combinador de señal Internet + TV |
| **Mini Red** | Armar red de pruebas (splitters + ONU de prueba) para validar nuevas OLT |
| **Consola** | Acceso por cable consola USB a tarjeta HSWA de la OLT |
| **Coordinación con Soporte** | Indicar puertos disponibles, estado físico de equipos |

#### Hardware que gestiona Cabecera

| Equipo | Módulo/Componente | Conexión |
|--------|-------------------|----------|
| OLT → Switch | XFP-10G-SR + SFP-10G-SR | Patch cord LC/UPC Duplex Multimodo |
| 815 → Switch | SFP-10G-SR + SFP-10G-SR | Patch cord LC/UPC Duplex Multimodo |
| OLT Consola | Cable USB | A laptop con AnyDesk |
| Mini Red | Splitters + ONU prueba | Validación de nueva OLT |

---

### 📞 Área de Telefonía (4 personas)

**Rol principal**: Gestión de servicios de voz sobre la infraestructura FTTH (VoIP/SIP).

| Función | Detalle |
|---------|---------|
| **Registro SIP** | Gestión del registro SIP en las ONUs con servicio de voz |
| **Diagnóstico SIP fallido** | Identificar fallas de registro SIP (estado intermedio en OLT) |
| **ONUs con telefonía** | Configuración y soporte de ONUs FiberHome con servicio de voz |
| **Modo Bridge telefonía** | Soporte para ONUs FiberHome con telefonía en modo Bridge |
| **Coordinación con SISTEMAS** | Escalar problemas de registro SIP al equipo de demonios |
| **Calidad de voz** | Monitoreo y pruebas de calidad del servicio telefónico |

---

## 4. Flujo Operacional con Puntos de Intervención

```mermaid
flowchart TB
    START(["🔌 ONT FiberHome conectada"])

    START --> CHECK_POT{"¿Emite y recibe\npotencia?"}

    CHECK_POT -->|"NO"| ESCALAR_PE["⚠️ Escalar a\nPlanta Externa / ARU\n(No es Operaciones IP)"]
    CHECK_POT -->|"SÍ"| DISCOVERY["Estado: DISCOVERY"]

    DISCOVERY --> CHECK_UMBRAL{"¿Potencia dentro\nde umbrales?"}

    CHECK_UMBRAL -->|"NO"| SOPORTE_VAL["🛠️ SOPORTE\nValidar potencia TX/RX\nCoordinar con ARU"]
    CHECK_UMBRAL -->|"SÍ"| WHITELIST["Estado: WHITELIST"]

    WHITELIST --> DEMONIO_OLT["⚙️ Demonio OLT actúa\n(SISTEMAS)"]

    DEMONIO_OLT --> CHECK_OLT{"¿Llegó a\nAprovisionada OLT?"}

    CHECK_OLT -->|"NO - Estado intermedio"| CHECK_ESTADO{"¿Qué estado?"}

    CHECK_ESTADO -->|"ONU no autorizada\nVLAN fallido"| SOPORTE_ESC["🛠️ SOPORTE\nEscalar a SISTEMAS\n(Problema de demonio)"]
    CHECK_ESTADO -->|"SIP fallido"| TEL_SIP["📞 TELEFONÍA\nDiagnosticar registro SIP\nEscalar si es demonio"]

    CHECK_OLT -->|"SÍ"| APROV_OLT["✅ Aprovisionada en OLT"]

    APROV_OLT --> DEMONIO_815["⚙️ Demonio 815 actúa\n(SISTEMAS)"]

    DEMONIO_815 --> CHECK_815{"¿Conexión creada\nen 815?"}

    CHECK_815 -->|"NO"| CHECK_ERROR_815{"¿Causa?"}

    CHECK_ERROR_815 -->|"Instrucción pendiente\no errónea"| SOPORTE_SIS["🛠️ SOPORTE\nEscalar a SISTEMAS"]
    CHECK_ERROR_815 -->|"BD bloqueada\nIPs agotadas"| SOPORTE_SIS
    CHECK_ERROR_815 -->|"Problema HW\nen 815"| CAB_815["📡 CABECERA\nVerificar servidor 815\npuertos WAN/LAN"]

    CHECK_815 -->|"SÍ"| CHECK_MAC{"¿Color de MAC?"}

    CHECK_MAC -->|"🟢 VERDE"| OPERATIVO(["🎉 Servicio Operativo"])

    CHECK_MAC -->|"🔴 ROJO"| SOPORTE_MAC["🛠️ SOPORTE\n1. Verificar ONU encendida\n2. Validar MAC cargada vs actual\n3. Verificar modo Bridge"]

    SOPORTE_MAC --> CHECK_BRIDGE{"¿Es modo\nBRIDGE?"}
    CHECK_BRIDGE -->|"SÍ - IP Cert."| NO_TOUCH["⛔ NO reaprovisionar\nNO enviar REFRESH\nNO eliminar en Gx"]
    CHECK_BRIDGE -->|"SÍ - Empresa B"| PUEDE_GX["✅ Se puede eliminar\ny registrar en Gx"]
    CHECK_BRIDGE -->|"NO - Router"| SOPORTE_NORMAL["🛠️ SOPORTE\nProcedimiento estándar\nde troubleshooting"]

    style SOPORTE_VAL fill:#dc3545,color:#fff
    style SOPORTE_ESC fill:#dc3545,color:#fff
    style SOPORTE_SIS fill:#dc3545,color:#fff
    style SOPORTE_MAC fill:#dc3545,color:#fff
    style SOPORTE_NORMAL fill:#dc3545,color:#fff
    style CAB_815 fill:#fd7e14,color:#fff
    style TEL_SIP fill:#198754,color:#fff
    style ESCALAR_PE fill:#6f42c1,color:#fff
    style NO_TOUCH fill:#dc3545,color:#fff
    style PUEDE_GX fill:#198754,color:#fff
    style OPERATIVO fill:#0d6efd,color:#fff
```

---

## 5. Matriz RACI por Área

> **R** = Responsable | **A** = Aprueba | **C** = Consultado | **I** = Informado

| Actividad | Soporte (4) | Cabecera (4) | Telefonía (4) | SISTEMAS | Planta Ext. |
|-----------|:---:|:---:|:---:|:---:|:---:|
| Monitoreo de estado ONU | **R** | I | I | C | — |
| Diagnóstico de conectividad | **R** | C | — | C | C |
| Pruebas de velocidad (CLI) | **R** | C | — | — | — |
| Validación de potencia TX/RX | **R** | C | — | — | C |
| Verificación conexión en 815 | **R** | C | — | C | — |
| Instalación física OLT | I | **R** | — | C | — |
| Conexión OLT ↔ Switch | I | **R** | — | C | — |
| PortChannel (OLT o 815) | C | **R** | — | I | — |
| Setup físico Servidor 815 | I | **R** | — | C | — |
| Mantenimiento EDFA | I | **R** | — | — | — |
| Armar Mini Red de prueba | C | **R** | — | — | — |
| Registro SIP | C | — | **R** | C | — |
| Diagnóstico SIP fallido | C | — | **R** | C | — |
| ONUs con voz/telefonía | I | — | **R** | C | — |
| Modo Bridge (telefonía FH) | C | — | **R** | C | — |
| Escalamiento a SISTEMAS | **R** | C | **R** | **A** | — |
| Problemas de potencia óptica | C | — | — | — | **R** |

---

## 6. Protocolos de Escalamiento

```mermaid
flowchart LR
    subgraph NIVEL_1["NIVEL 1 — Operaciones IP"]
        SOP["🛠️ Soporte"]
        CAB["📡 Cabecera"]
        TEL["📞 Telefonía"]
    end

    subgraph NIVEL_2["NIVEL 2 — Otros Departamentos"]
        SIS["⚙️ SISTEMAS\n(Demonios OLT/815\nBD, instrucciones)"]
        PE["🔧 Planta Externa\n(Potencia óptica\nFibra, splitters)"]
        ARU["👷 ARU\n(Campo, hardware\ninstalaciones)"]
    end

    SOP -->|"Demonio no aprovisiona\nInstrucción pendiente/errónea\nBD bloqueada / IPs agotadas"| SIS
    TEL -->|"Registro SIP fallido\nproblema de demonio"| SIS
    SOP -->|"ONU no encontrada\nPotencia fuera de rango"| PE
    SOP -->|"Requiere intervención\nen campo"| ARU
    CAB -->|"Solicita puertos\ny configuración lógica"| SIS
    CAB -->|"Coordina instalación\nde planta"| ARU

    SOP <-->|"Estado HW\nen head end"| CAB
    SOP <-->|"Falla involucra\nregistro SIP"| TEL
    CAB <-->|"ONU con voz\nen cabecera"| TEL

    style SOP fill:#dc3545,color:#fff
    style CAB fill:#fd7e14,color:#fff
    style TEL fill:#198754,color:#fff
    style SIS fill:#6f42c1,color:#fff
    style PE fill:#0d6efd,color:#fff
    style ARU fill:#6c757d,color:#fff
```

### Criterios de Escalamiento

| Desde | Hacia | Cuándo escalar |
|-------|-------|----------------|
| **Soporte** → SISTEMAS | ONU en estado intermedio (Discovery, no autorizada, VLAN/SIP fallido), instrucción pendiente/errónea en 815, BD bloqueada, IPs agotadas |
| **Soporte** → Planta Ext. | ONU no encontrada, potencia fuera de umbrales, problemas de fibra |
| **Soporte** → Cabecera | Sospecha de falla en hardware (OLT, Switch, 815), puerto dañado |
| **Soporte** → Telefonía | Incidencia involucra registro SIP o servicio de voz |
| **Telefonía** → SISTEMAS | Registro SIP fallido por problema de demonio |
| **Cabecera** → SISTEMAS | Requiere configuración lógica post-instalación HW |
| **Cabecera** → ARU | Instalación en campo, mini red, módulos |

---

## 7. Resumen Visual — Las 3 Áreas en el Flujo

```mermaid
flowchart TB
    subgraph FLUJO_COMPLETO["FLUJO FTTH COMPLETO"]
        direction LR

        subgraph ZONA_SOPORTE["🛠️ ZONA SOPORTE"]
            MON["Monitoreo\nestados ONU"]
            DIAG["Diagnóstico\nconectividad"]
            VEL["Pruebas\nvelocidad"]
            VERIF["Verificación\n815"]
        end

        subgraph ZONA_CABECERA["📡 ZONA CABECERA"]
            HW_OLT["Hardware\nOLT"]
            HW_SW["Conexión\nSwitch"]
            HW_815["Setup\n815"]
            PC["PortChannel"]
            MINI["Mini Red"]
        end

        subgraph ZONA_TELEFONIA["📞 ZONA TELEFONÍA"]
            SIP["Registro\nSIP"]
            VOZ["Servicio\nde voz"]
            BRIDGE_T["Bridge con\ntelefonía"]
        end
    end

    subgraph INFRA["INFRAESTRUCTURA"]
        direction LR
        ONT_F["ONT FH"] --> SPLIT["Splitters"] --> EDFA_F["EDFA"] --> OLT_F["OLT"] --> SW_F["Switch"] --> S815["815"] --> NET["Internet"]
    end

    MON -.-> ONT_F
    DIAG -.-> OLT_F
    VEL -.-> ONT_F
    VERIF -.-> S815

    HW_OLT -.-> OLT_F
    HW_SW -.-> SW_F
    HW_815 -.-> S815
    PC -.-> SW_F
    MINI -.-> OLT_F

    SIP -.-> OLT_F
    VOZ -.-> S815
    BRIDGE_T -.-> ONT_F

    style ZONA_SOPORTE fill:#dc354522,stroke:#dc3545,stroke-width:2px
    style ZONA_CABECERA fill:#fd7e1422,stroke:#fd7e14,stroke-width:2px
    style ZONA_TELEFONIA fill:#19875422,stroke:#198754,stroke-width:2px
    style SW_F fill:#ffc107,color:#000
```

> [!TIP]
> **Distribución de carga sugerida**: Con 4 personas por área, se recomienda esquema de turnos rotativo para garantizar cobertura continua, donde al menos 2 personas estén activas por turno en cada área, permitiendo atender incidencias simultáneas sin dejar descubierta la operación.
