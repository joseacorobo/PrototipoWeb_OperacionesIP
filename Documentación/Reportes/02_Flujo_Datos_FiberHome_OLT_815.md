# Flujo de Datos FTTH — ONT FiberHome → Switch (OLT ∥ 815)

## 1. Flujo Físico de Datos (Capa Óptica → Capa de Red)

```mermaid
flowchart TB
    subgraph ABONADO["🏠 ABONADO (Netuno)"]
        ONT["ONT FiberHome\nSerial PON: FHTT\nModo: Router / Bridge"]
    end

    subgraph PLANTA_EXTERNA["🌐 PLANTA EXTERNA (Red Óptica)"]
        SP16["Splitter 1:16\n(Divisor de potencia)"]
        SP4["Splitter 1:4\n(Divisor de potencia)"]
        SP2["Splitter 1:2\n(Cassette)"]
    end

    subgraph HEADEND["🏢 HEAD END / ARU"]
        EDFA["EDFA\n(Combina señal Internet + TV)"]

        subgraph OLT_BLOCK["OLT (Capa 2)"]
            PON["Puertos PON\nSlots 1-8 / 11-18\n(Tarjetas de abonados)"]
            CTRL["Controladora\nSlot 9 (Master)\nSlot 10 (Slave)"]
            UPLINK["Tarjeta UPLINK\nXFP-10G-SR"]
        end

        PATCH["Patch Cord\nLC/UPC Duplex Multimodo"]

        subgraph SW_BLOCK["SWITCH"]
            SW_PORT["Puerto Switch\nSFP-10G-SR\n(10G estándar / 20G PortChannel)"]
        end

        subgraph SRV_BLOCK["SERVIDOR 815 (Capa 3)"]
            SRV_WAN["Puerto WAN"]
            SRV_LAN["Puerto LAN"]
            SRV_MGMT["Puerto Gestión"]
        end
    end

    subgraph UPSTREAM["☁️ UPSTREAM"]
        NETUNO["Sw Netuno"]
        INTERNET["Gateway Internet"]
    end

    ONT -->|"Fibra óptica\n(señal PON)"| SP16
    SP16 --> SP4
    SP4 --> SP2
    SP2 --> EDFA
    EDFA -->|"Señal combinada"| PON
    PON --- CTRL
    CTRL --- UPLINK
    UPLINK -->|"XFP-10G-SR"| PATCH
    PATCH -->|"SFP-10G-SR"| SW_PORT
    SW_PORT -->|"Tráfico LAN"| SRV_WAN
    SRV_LAN --> NETUNO
    NETUNO --> INTERNET

    style ONT fill:#0d6efd,color:#fff,stroke:#0a58ca
    style EDFA fill:#6610f2,color:#fff
    style PON fill:#dc3545,color:#fff
    style CTRL fill:#dc3545,color:#fff
    style UPLINK fill:#dc3545,color:#fff
    style SW_PORT fill:#fd7e14,color:#fff
    style SRV_WAN fill:#198754,color:#fff
    style SRV_LAN fill:#198754,color:#fff
    style SRV_MGMT fill:#198754,color:#fff
    style NETUNO fill:#6f42c1,color:#fff
```

> [!NOTE]
> **Flujo FiberHome específico**: La red sigue el patrón **Netuno → Inter → Netuno** (a diferencia de Huawei que es Inter → Netuno → Inter). El abonado pertenece a **Netuno** y el serial PON es **FHTT**.

---

## 2. Flujo Lógico de Aprovisionamiento — Trabajo en Paralelo

El aprovisionamiento se ejecuta en **2 etapas secuenciales** mediante **demonios automatizados** (administrados por **SISTEMAS**, no por Operaciones IP). Sin embargo, dentro del headend, la configuración del OLT y el 815 operan como procesos que **convergen** sobre el Switch.

```mermaid
flowchart LR
    subgraph ETAPA_1["⚙️ ETAPA I — DEMONIO OLT (Capa 2)"]
        direction TB
        D_OLT["Demonio OLT\n(Automatizado - SISTEMAS)"]
        MAC["Configurar MAC"]
        VLAN["Asignar VLANs"]
        WAN_CFG["Configurar WAN"]
        D_OLT --> MAC --> VLAN --> WAN_CFG
    end

    subgraph CONVERGENCIA["🔀 SWITCH\n(Punto de Convergencia)"]
        direction TB
        SW["Switch de Distribución\n10G / 20G PortChannel"]
    end

    subgraph ETAPA_2["⚙️ ETAPA II — DEMONIO 815 (Capa 3)"]
        direction TB
        D_815["Demonio 815\n(Automatizado - SISTEMAS)"]
        DHCP["Configurar DHCP"]
        IP["Asignar IP"]
        WANMAC["Configurar WANMAC"]
        GW["Definir Gateway"]
        PLAN["Aplicar Plan\nde Navegación"]
        D_815 --> DHCP --> IP --> WANMAC --> GW --> PLAN
    end

    WAN_CFG -->|"Tráfico L2\n(OLT → SW)"| SW
    SW -->|"Tráfico L3\n(SW → 815)"| D_815

    style D_OLT fill:#dc3545,color:#fff
    style D_815 fill:#198754,color:#fff
    style SW fill:#fd7e14,color:#fff
    style MAC fill:#f8d7da,color:#842029
    style VLAN fill:#f8d7da,color:#842029
    style WAN_CFG fill:#f8d7da,color:#842029
    style DHCP fill:#d1e7dd,color:#0f5132
    style IP fill:#d1e7dd,color:#0f5132
    style WANMAC fill:#d1e7dd,color:#0f5132
    style GW fill:#d1e7dd,color:#0f5132
    style PLAN fill:#d1e7dd,color:#0f5132
```

> [!IMPORTANT]
> El **Demonio 815 solo actúa DESPUÉS** de que la ONU alcanza el estado "Aprovisionada en OLT". No son procesos verdaderamente paralelos, sino **secuenciales con convergencia en el Switch**.

---

## 3. Diagrama de Estados de la ONU FiberHome

```mermaid
stateDiagram-v2
    [*] --> ONU_Conectada: ONT FiberHome energizada

    ONU_Conectada --> Discovery: Emite y recibe potencia
    ONU_Conectada --> No_Encontrada: Sin conectividad óptica

    No_Encontrada --> ONU_Conectada: Reparación planta externa\n(NO es Operaciones IP)

    Discovery --> Whitelist: Potencia dentro de umbrales\nONU homologada y reconocida

    Discovery --> ONU_No_Autorizada: Potencia fuera de rango\no ONU no homologada

    state ETAPA_I {
        Whitelist --> Config_MAC: Demonio OLT configura MAC
        Config_MAC --> Config_VLAN: Asigna VLANs
        Config_VLAN --> Config_WAN: Configura WAN
        Config_WAN --> Aprovisionada_OLT: ✅ Configuración exitosa
    }

    Whitelist --> SIP_Fallido: Error en registro SIP
    Whitelist --> VLAN_Fallido: Error en registro VLAN
    SIP_Fallido --> Whitelist: Problema de SISTEMAS\n(Demonio)
    VLAN_Fallido --> Whitelist: Problema de SISTEMAS\n(Demonio)

    state ETAPA_II {
        Aprovisionada_OLT --> Creando_Conexion_815: Demonio 815 actúa
        Creando_Conexion_815 --> MAC_Verde: ✅ Conexión exitosa\nServicio operativo
        Creando_Conexion_815 --> MAC_Rojo: ⚠️ ONU apagada o\nincongruencia MAC
    }

    Aprovisionada_OLT --> Instruccion_Pendiente: Instrucción no generada
    Aprovisionada_OLT --> Instruccion_Erronea: Caracteres inválidos
    Aprovisionada_OLT --> BD_Bloqueada: Bloqueo BD del 815
    Aprovisionada_OLT --> IP_Agotadas: Sin IPs disponibles

    MAC_Verde --> [*]: 🎉 Abonado operativo

    note right of ETAPA_I: Capa 2 — OLT\nMAC + VLANs + WAN
    note right of ETAPA_II: Capa 3 — Servidor 815\nDHCP + IP + Gateway + Plan
```

---

## 4. Trabajo en "Paralelo" — Vista de Convergencia en el Switch

El Switch es el **punto de convergencia** donde ambos flujos (OLT y 815) se encuentran. Desde la perspectiva del Switch, gestiona **simultáneamente** el tráfico de ambos equipos:

```mermaid
flowchart TB
    subgraph DATOS_OLT["📤 FLUJO DESDE OLT"]
        direction LR
        OLT_UP["OLT\nUplink XFP-10G-SR"] -->|"Tráfico L2\nMAC/VLAN"| SW_OLT["Puerto Switch\n(hacia OLT)"]
    end

    subgraph SWITCH_CENTRAL["🔀 SWITCH (Convergencia)"]
        direction TB
        SW_OLT2["Puertos OLT\n(1 o 2 enlaces)"]
        SW_CORE["Tabla de\nConmutación"]
        SW_815["Puertos 815\n(WAN)"]
        SW_OLT2 --> SW_CORE
        SW_CORE --> SW_815
    end

    subgraph DATOS_815["📥 FLUJO HACIA 815"]
        direction LR
        SW_815_OUT["Puerto Switch\n(hacia 815)"] -->|"Tráfico L3\nIP/DHCP/Gateway"| SRV["Servidor 815\nPuerto WAN"]
    end

    subgraph UPSTREAM_NET["☁️ UPSTREAM"]
        direction LR
        SRV_LAN["815 Puerto LAN"] --> SW_NET["Sw Netuno"] --> INET["Internet\n(Comcast)"]
    end

    SW_OLT --> SW_OLT2
    SW_815 --> SW_815_OUT
    SRV --> SRV_LAN

    style OLT_UP fill:#dc3545,color:#fff
    style SW_CORE fill:#fd7e14,color:#fff
    style SRV fill:#198754,color:#fff
    style SW_NET fill:#6f42c1,color:#fff
```

### Capacidades de Enlace Switch ↔ OLT / 815

| Conexión | Estándar | PortChannel | Módulo |
|----------|:---:|:---:|------|
| **OLT → Switch** | 10 Gbps | 20 Gbps (2 enlaces) | XFP-10G-SR (OLT) + SFP-10G-SR (Switch) |
| **Switch → 815** | 10 Gbps | 20 Gbps (2 enlaces) | SFP-10G-SR ambos lados |

---

## 5. Matriz de Responsabilidades

| Componente | Responsable | Alcance |
|------------|------------|---------|
| **ONT FiberHome** (potencia óptica) | Planta Externa / ARU | Problemas de potencia, conexión física |
| **Demonio OLT** (aprovisionamiento L2) | SISTEMAS | Automatización, estados intermedios |
| **Demonio 815** (aprovisionamiento L3) | SISTEMAS | Creación conexiones, IPs, planes |
| **Switch** (conectividad) | Operaciones IP | Puertos, PortChannel, módulos |
| **Pruebas de velocidad** | Operaciones IP / ARU | CLI, contra Speedtest Inter, puerto GE de ONU |
| **Soporte FibraHogar** | Soporte | Verificar ONU encendida, estados |

---

## 6. Reglas Operacionales Críticas — FiberHome

> [!CAUTION]
> **Prohibiciones para ONUs FiberHome en modo BRIDGE:**
> - ❌ NO reaprovisionar por Soporte FibraHogar
> - ❌ NO enviar REFRESH por Soporte FibraHogar
> - ❌ NO eliminar en Gx si es IP certificada
> - ✅ SÍ se pueden eliminar/registrar en Gx si son **Empresa B**

| Modo ONU | Uso | Restricciones |
|----------|-----|---------------|
| **Router** | Abonado residencial estándar | Sin restricciones especiales |
| **Bridge** | IP certificada / Empresa B (Huawei) | Ver prohibiciones arriba |
| **Bridge** (FH nuevas) | Último firmware | Ahora soportado en ONUs sencillas |
