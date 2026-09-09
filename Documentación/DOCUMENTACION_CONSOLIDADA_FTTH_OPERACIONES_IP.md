# LEVANTAMIENTO TÉCNICO Y OPERACIONAL: RED FTTH & OPERACIONES IP

---

## 📑 Tabla de Contenido
1. [Introducción y Alcance](#1-introducción-y-alcance)
2. [Análisis de la Documentación Base](#2-análisis-de-la-documentación-base)
3. [Flujo Físico y Óptico de Datos (ONT FiberHome ➔ Switch)](#3-flujo-físico-y-óptico-de-datos-ont-fiberhome--switch)
4. [Flujo Lógico y Trabajo en Paralelo / Convergencia (OLT ∥ 815)](#4-flujo-lógico-y-trabajo-en-paralelo--convergencia-olt--815)
5. [Ciclo de Vida y Estados de la ONT FiberHome](#5-ciclo-de-vida-y-estados-de-la-ont-fiberhome)
6. [Estructura y Gestión del Departamento de Operaciones IP](#6-estructura-y-gestión-del-departamento-de-operaciones-ip)
7. [Matriz RACI y Protocolos de Escalamiento](#7-matriz-raci-y-protocolos-de-escalamiento)
8. [Reglas Operacionales y Políticas Críticas](#8-reglas-operacionales-y-políticas-críticas)

---

## 1. Introducción y Alcance

Este documento consolida el levantamiento técnico y operativo de la infraestructura de red **FTTH (Fiber To The Home)** y el modelo de gestión para el **Departamento de Operaciones IP** de Inter.

Cubre el recorrido de datos desde el abonado con equipo **ONT FiberHome** (con serial PON `FHTT` bajo la topología de red Netuno – Inter – Netuno) a través de la planta externa, el Head End (OLT, EDFA, Servidor 815, Switch de distribución), y la distribución de responsabilidades entre los tres frentes operativos del departamento: **Soporte de Operaciones**, **Cabecera** y **Telefonía** (4 especialistas por área, total 12 personas).

---

## 2. Análisis de la Documentación Base

Se procesaron y extrajeron dos documentos maestros de capacitación de la Vicepresidencia de Ingeniería y Operaciones Técnicas:

| Documento Fuente | Diapositivas | Imágenes Extraídas | Contenido Principal |
|------------------|:------------:|:------------------:|---------------------|
| `Capacitacion FTTH.pptx` | 23 | 110 | Hardware OLT/815, aprovisionamiento en 2 etapas, mini red, interfaces SFP/XFP, reglas de velocidad y modo bridge. |
| `EsquemaOLT_SW_815_FTTH_General v2.pptx` | 14 | 61 | Diagramas de convergencia OLT-Switch-815, esquemas Inter-Netuno y Netuno-Inter, puntos críticos de operación. |
| **Totales** | **37** | **171** | Respaldo íntegro preservado en `Documentación/Extraido/` |

> [!WARNING]
> **Seguridad / Credenciales identificadas en material original:**
> - Portal: `http://soportearu.inter.com.ve/accounts/login/`
> - Usuario referenciado: `InterAru`
> - Clave referenciada: `Aru*Intercable2023`
> *(Se recomienda auditar y rotar accesos según las políticas corporativas de ciberseguridad).*

---

## 3. Flujo Físico y Óptico de Datos (ONT FiberHome ➔ Switch)

El recorrido de la señal óptica y la agregación de tráfico se estructura desde la premisa del abonado hasta los equipos de distribución:

```mermaid
flowchart TB
    subgraph ABONADO["🏠 PREMISA DEL ABONADO (Netuno)"]
        ONT["ONT FiberHome\nSerial PON: FHTT\nModo Router / Bridge"]
    end

    subgraph ODN["🌐 RED ÓPTICA PASIVA (ODN / Planta Externa)"]
        SP16["Splitter de Distribución 1:16"]
        SP4["Splitter de Segundo Nivel 1:4"]
        SP2["Splitter Primer Nivel / Cassette 1:2"]
    end

    subgraph HEADEND["🏢 HEAD END / CABECERA / ARU"]
        EDFA["EDFA\n(Combina Internet 1310/1490nm + CATV 1550nm)"]
        
        subgraph OLT_SISTEMA["OLT (Capa 2)"]
            PON["Tarjetas PON (GCOB)\nSlots 1 al 8 y 11 al 18"]
            CTRL["Tarjetas Controladoras (HSWA)\nSlot 9 (Master) / Slot 10 (Slave)"]
            UPLINK["Tarjeta de UPLINK\nMódulo XFP-10G-SR"]
        end

        PATCH["Patch Cord Óptico\nLC/UPC - LC/UPC Duplex Multimodo"]

        subgraph SWITCH_DIST["SWITCH DE DISTRIBUCIÓN"]
            SW_PORT["Puertos Switch\nMódulos SFP-10G-SR\n(10G Estándar / 20G PortChannel)"]
        end

        subgraph SRV_815["SERVIDOR GATEWAY 815 (Capa 3)"]
            P_WAN["Interfaz WAN (Hacia Switch)"]
            P_LAN["Interfaz LAN (Hacia Upstream)"]
            P_MGMT["Puerto de Gestión Out-of-band"]
        end
    end

    subgraph SALIDA["☁️ TRÁFICO EXTERNO"]
        SW_NETUNO["Switch de Tránsito Netuno"]
        INTERNET["Salida Internacional (Comcast / Tránsito IP)"]
    end

    ONT -->|"Fibra Drop"| SP16
    SP16 --> SP4
    SP4 --> SP2
    SP2 --> EDFA
    EDFA --> PON
    PON --- CTRL
    CTRL --- UPLINK
    UPLINK -->|"Enlace 10G / 20G"| PATCH
    PATCH --> SW_PORT
    SW_PORT -->|"VLANs Abonados"| P_WAN
    P_LAN --> SW_NETUNO
    SW_NETUNO --> INTERNET
```

### Especificaciones de Conectividad Física y Módulos

- **OLT hacia Switch:** Módulo **XFP-10G-SR** en la tarjeta de Uplink de la OLT conectado mediante Patch Cord LC/UPC-LC/UPC Duplex Multimodo hacia módulo **SFP-10G-SR** en el Switch.
- **Switch hacia Servidor 815:** Módulos **SFP-10G-SR** en ambos extremos (interfaz WAN del 815 y puerto de distribución del Switch).
- **Esquema PortChannel:** Implementado para pasar de **10 Gbps a 20 Gbps** uniendo dos interfaces físicas para prevenir saturación tanto en el Uplink de la OLT como en el Gateway 815.

---

## 4. Flujo Lógico y Trabajo en Paralelo / Convergencia (OLT ∥ 815)

El aprovisionamiento del cliente se compone de **dos fases secuenciales gestionadas por demonios automatizados de SISTEMAS**, las cuales convergen en el **Switch de distribución**:

```mermaid
flowchart LR
    subgraph ETAPA_I["⚙️ ETAPA I: CAPA 2 (OLT)"]
        direction TB
        DEM_OLT["Demonio OLT\n(Gestionado por SISTEMAS)"]
        D_MAC["Asignación de MAC"]
        D_VLAN["Configuración de VLANs"]
        D_WAN["Configuración parámetros WAN"]
        DEM_OLT --> D_MAC --> D_VLAN --> D_WAN
    end

    subgraph NODO_CONVERGENCIA["🔀 SWITCH DE CONMUTACIÓN\n(Punto de Encuentro L2/L3)"]
        SW_CORE["Conmutación de VLANs\nControl de Enlaces 10G/20G"]
    end

    subgraph ETAPA_II["⚙️ ETAPA II: CAPA 3 (SERVIDOR 815)"]
        direction TB
        DEM_815["Demonio 815\n(Gestionado por SISTEMAS)"]
        D_DHCP["Servicio DHCP"]
        D_IP["Asignación de Dirección IP"]
        D_WMAC["Mapeo de WANMAC"]
        D_GW["Asignación de Gateway"]
        D_PLAN["Aplicación de Plan / Rate Limiting"]
        DEM_815 --> D_DHCP --> D_IP --> D_WMAC --> D_GW --> D_PLAN
    end

    D_WAN -->|"Tráfico Capa 2 listo"| SW_CORE
    SW_CORE -->|"Habilita sesión L3"| DEM_815
```

### Dinámica de "Paralelismo" y Dependencia Operativa:
1. **No es un procesamiento simultáneo ciego:** El Demonio 815 se dispara **únicamente** cuando la OLT confirma el estado exitoso `Aprovisionada en OLT`.
2. **Convergencia en Switch:** El Switch mantiene activas las tablas L2 (VLANs, MAC learning) provenientes de la OLT y enruta los flujos hacia las interfaces WAN del Servidor 815 donde se aplica el direccionamiento IP y control de ancho de banda.

---

## 5. Ciclo de Vida y Estados de la ONT FiberHome

```mermaid
stateDiagram-v2
    [*] --> Encendido: ONT Conectada a la red óptica
    
    Encendido --> Discovery: Emite y recibe potencia normal
    Encendido --> ONU_No_Encontrada: Sin señal óptica / Atenuación extrema
    ONU_No_Encontrada --> [*]: Requiere atención de Planta Externa

    Discovery --> Whitelist: Potencia dentro de rangos y ONU homologada
    Discovery --> No_Autorizada: Potencia fuera de rango o modelo no reconocido
    
    state "Fase I: Aprovisionamiento en OLT" as Fase1 {
        Whitelist --> Registro_VLAN: Demonio OLT envía instrucción
        Registro_VLAN --> Registro_SIP: Enlace de parámetros
        Registro_SIP --> Aprovisionada_OLT: Registro exitoso Capa 2
        
        Registro_VLAN --> VLAN_Fallida: Error de Demonio
        Registro_SIP --> SIP_Fallido: Falla en telefonía / Demonio
    }

    state "Fase II: Aprovisionamiento en 815" as Fase2 {
        Aprovisionada_OLT --> Creacion_Conexion: Demonio 815 genera instrucción
        Creacion_Conexion --> MAC_Verde: IP asignada + WANMAC sincronizada
        Creacion_Conexion --> MAC_Roja: ONU apagada / Discrepancia de MAC
        
        Creacion_Conexion --> Falla_Instruccion: Instrucción errónea o pendiente
        Creacion_Conexion --> Falla_BD: Bloqueo BD / Pool IP agotado
    }

    MAC_Verde --> Operativo: Cliente con navegación activa
    Operativo --> [*]
```

---

## 6. Estructura y Gestión del Departamento de Operaciones IP

El departamento cuenta con un equipo de **12 especialistas**, distribuidos equitativamente en 3 áreas técnicas (4 personas por área):

```mermaid
flowchart TD
    DEP_IP["🏢 Departamento de Operaciones IP (12 personas)"]
    
    AREA_SOP["🛠️ Soporte de Operaciones\n(4 Personas)\nCapa Lógica & Diagnóstico End-to-End"]
    AREA_CAB["📡 Cabecera / Head End\n(4 Personas)\nInfraestructura Física, OLT, Switch, 815"]
    AREA_TEL["📞 Telefonía\n(4 Personas)\nServicios de Voz, SIP, VoIP en ONTs"]
    
    DEP_IP --> AREA_SOP
    DEP_IP --> AREA_CAB
    DEP_IP --> AREA_TEL
```

### Funciones y Alcance por Área Técnica

#### 1. 🛠️ Área de Soporte de Operaciones (4 personas)
- **Monitoreo de Aprovisionamiento:** Seguimiento en tiempo real de ONTs en estados `Discovery`, `Whitelist`, `Aprovisionada en OLT` y color de MAC (`Verde`/`Roja`).
- **Validación Lógica:** Revisión de concordancia entre la MAC registrada y la MAC física.
- **Verificación en Servidor 815:** Auditoría de asignación de pools de IPs, gateway asignado y plan de velocidad.
- **Certificación de Pruebas de Velocidad:**
  - Pruebas estrictamente por **CLI** (evitando distorsión por CPU/RAM de navegador).
  - Medición directa en puerto **GE** de la ONT con cable de red certificado.
  - Test contra el servidor Speedtest de Inter más próximo y comparativa con Comcast.
- **Atención de Guardias:** Detección temprana de bloqueos de demonios o agotamiento de direccionamiento.

#### 2. 📡 Área de Cabecera / Head End (4 personas)
- **Instalación y Expansión Física:** Montaje de chasis OLT, inserción de tarjetas PON (GCOB), controladoras (HSWA) y uplinks.
- **Gestión de Enlaces Ópticos Internos:** Tendido y validación de patch cords dúplex multimodo LC/UPC y módulos 10G (XFP/SFP).
- **Configuración de PortChannel:** Implementación de agregación de enlaces a 20 Gbps en OLTs y Servidores 815 de alta densidad.
- **Mantenimiento de EDFAs:** Verificación de mezcla de señal óptica de datos con televisión analógica/digital.
- **Puesta en Servicio (Mini Red):** Armado de topologías de prueba con splitters locales y ONT testigo antes de liberar OLTs a producción.

#### 3. 📞 Área de Telefonía (4 personas)
- **Aprovisionamiento SIP:** Configuración de parámetros VoIP, perfiles SIP y dialplans en ONTs FiberHome compatibles.
- **Resolución de Fallas SIP:** Diagnóstico de ONTs atascadas en estado `Registro SIP fallido`.
- **Soporte a Modo Bridge:** Gestión de configuraciones bridge que preservan el puerto telefónico analógico (POTS / RJ11) funcionando en la ONT.
- **Calidad de Servicio (QoS):** Validación de priorización de paquetes de voz en VLANs dedicadas.

---

## 7. Matriz RACI y Protocolos de Escalamiento

> **R** = Responsable de ejecución | **A** = Aprobador / Responsable final | **C** = Consultado | **I** = Informado

| Actividad / Incidencia | Soporte (4) | Cabecera (4) | Telefonía (4) | SISTEMAS | Planta Externa |
|------------------------|:-----------:|:------------:|:-------------:|:--------:|:--------------:|
| Monitoreo de Estados ONT | **R** | I | I | C | — |
| Falla "ONU No Encontrada" | **R** | — | — | — | **A / R** |
| Registro VLAN / SIP Fallido | **R** | — | **R** | **A** | — |
| Saturación de Uplink (PortChannel 20G) | C | **R** | — | C | — |
| Mantenimiento Físico OLT / 815 | I | **R** | — | C | — |
| Bloqueo de BD 815 / IPs Agotadas | **R** | C | — | **A / R** | — |
| Diagnóstico Telefonía VoIP | C | — | **R** | C | — |
| Pruebas de Velocidad Oficiales (CLI) | **R** | C | — | — | — |

```mermaid
flowchart TD
    INCIDENTE["⚠️ Detección de Incidencia"]
    
    INCIDENTE --> TIPO{"Tipo de Falla"}
    
    TIPO -->|"Atenuación / Sin Señal Óptica"| ESC_PE["Planta Externa / Cuadrilla ARU\n(Inspección de fibra/splitter)"]
    TIPO -->|"Falla de Demonio / Instrucción / BD"| ESC_SIS["SISTEMAS\n(Demonios OLT/815, Liberación de IPs)"]
    TIPO -->|"Falla de Hardware / Puerto / SFP"| ESC_CAB["Cabecera (Operaciones IP)\n(Reemplazo SFP/Patchcord/Slot)"]
    TIPO -->|"Falla Registro de Voz"| ESC_TEL["Telefonía (Operaciones IP)\n(Verificación servidor SIP/Parámetros)"]
```

---

## 8. Reglas Operacionales y Políticas Críticas

### 🚫 Políticas Estrictas sobre Modo BRIDGE:
- **PROHIBIDO REAPROVISIONAR:** Bajo ninguna circunstancia aplicar reaprovisionamiento ni enviar comandos `REFRESH` desde Soporte FibraHogar a ONTs en modo **BRIDGE** (sean de IP certificada o Empresa B).
- **POLÍTICA SOBRE Gx:**
  - **NO eliminar en Gx** las ONTs configuradas en modo BRIDGE con **IP Certificada**.
  - **SÍ se permite** eliminar y registrar en Gx las ONTs de **Empresa B**.

### 🔍 Interpretación de Estados en Servidor 815:
- **MAC en VERDE:** Conexión creada satisfactoriamente. Cliente navegando bajo su plan asignado.
- **MAC en ROJO:**
  1. Verificar en Soporte FH si la ONT se encuentra físicamente apagada.
  2. Verificar discrepancia entre la MAC cargada en base de datos y la MAC real que negocia la ONT.
  3. En clientes Bridge, verificar que la MAC corresponda al router/firewall del abonado conectado al puerto GE.

### ⚡ Estándar de Pruebas de Velocidad:
- No aceptar capturas de pruebas realizadas sobre navegadores web en PCs de clientes o vía Wi-Fi.
- La certificación válida requiere conexión cableada directa al puerto GE de la ONT mediante interfaz CLI apuntando a los servidores internos de Speedtest Inter.
