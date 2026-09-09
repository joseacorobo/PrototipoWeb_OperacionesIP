# 📋 Análisis de Documentación FTTH — Levantamiento

## Resumen Ejecutivo

Se extrajeron exitosamente **2 presentaciones PowerPoint** de la carpeta `Documentación`, obteniendo todo el texto y las imágenes. Ambos archivos pertenecen al área de **Vicepresidencia de Ingeniería y Operaciones Técnicas** de **Inter** y documentan la infraestructura de red **FTTH (Fiber To The Home)**.

---

## 📊 Estadísticas de Extracción

| Archivo | Diapositivas | Imágenes Extraídas | Tamaño Original |
|---------|:---:|:---:|:---:|
| **Capacitacion FTTH.pptx** | 23 | 110 | ~12 MB |
| **EsquemaOLT_SW_815_FTTH_General v2.pptx** | 14 | 61 | ~2.9 MB |
| **TOTAL** | **37** | **171** | **~14.9 MB** |

> [!NOTE]
> Los archivos extraídos se encuentran en:
> `Documentación\Extraido\[nombre del archivo]\`
> - Texto completo en formato Markdown (`.md`)
> - Imágenes en carpeta `imagenes/` (formatos: `.png`, `.jpg`, `.x-wmf`)

---

## 📖 Archivo 1: Capacitacion FTTH.pptx

### Propósito
Material de **capacitación completo para ARUs** (técnicos de campo) sobre la red FTTH, cubriendo desde la teoría hasta los procedimientos prácticos.

### Estructura Temática (23 diapositivas)

| Sección | Diapositivas | Tema |
|---------|:---:|------|
| **Introducción** | 1–2 | Portada y hardware de la red (OLT, Switch 815, Receiver, Splitter, ONU, EDFA) |
| **Arquitectura de Red** | 3–5 | Esquemas de red FTTH con flujos Inter/Netuno, demonios OLT/815, marcas Huawei (HWTC) y FiberHome (FHTT) |
| **Visión General** | 6–8 | Proceso de aprovisionamiento en 2 etapas, estados de ONU, modo Router vs Bridge, reglas operacionales |
| **Actividades OLT** | 9–13 | Configuración de OLT, hardware necesario (SFP/XFP-10G-SR), PortChannel (10G→20G) |
| **Servidor 815** | 14–17 | Modelos de servidor, puertos (gestión/LAN/WAN), setup gateway, PortChannel en 815 |
| **Troubleshooting** | 18–19 | Referencia al Manual ARU en soportearu.inter.com.ve, fallas descritas |
| **Validación** | 20–22 | Mini Red para validación de potencia, valores de ONU, velocidad de negociación Ethernet |
| **Cierre** | 23 | Agradecimiento |

### Contenido Técnico Clave

#### Proceso de Aprovisionamiento (2 Etapas)
1. **Etapa I — OLT** (Capa 2): MAC, VLANs, WAN
2. **Etapa II — Servidor 815** (Capa 3): DHCP, IP, WANMAC, gateway, planes de navegación

#### Estados de la ONU
```
Discovery → Whitelist → Aprovisionada en OLT → Conexión en 815 (MAC VERDE)
```

> [!IMPORTANT]
> **Reglas Críticas Identificadas:**
> - NO reaprovisionar ni enviar REFRESH a ONUs en modo **BRIDGE** (IP certificada o Empresa B)
> - NO eliminar en Gx ONUs en modo BRIDGE IP certificada
> - SÍ se pueden eliminar y registrar en Gx ONUs **Empresa B**
> - Los problemas de potencia **NO** se resuelven desde Operaciones IP

#### Marcas de ONU y Serial PON
| Marca | Serial PON | Observaciones |
|-------|-----------|---------------|
| **Huawei** | HWTC | Red Inter → Netuno → Inter |
| **FiberHome** | FHTT | Red Netuno → Inter → Netuno |

#### Hardware Documentado
- **OLT**: Slots 1-8 y 11-18 (tarjetas de abonados), Slot 9 Master, Slot 10 Slave
- **Módulos**: SFP-10G-SR (switch), XFP-10G-SR (OLT)
- **Conectores**: Patch cord LC/UPC Duplex Multimodo
- **Servidor 815**: Puertos de gestión, LAN y WAN

#### Procedimientos de Prueba de Velocidad
- Ejecutar por **CLI** (no interfaz gráfica)
- Contra servidor **Speedtest INTER** más cercano
- Conectados al **puerto GE de la ONU** con cable categorizado
- Pruebas a **Comcast** como medida del proveedor internacional

---

## 📖 Archivo 2: EsquemaOLT_SW_815_FTTH_General v2.pptx

### Propósito
**Esquemas visuales y resumen conceptual** de la arquitectura OLT-Switch-815 para la red FTTH. Versión 2, elaborada el **29/11/2023** por Operaciones IP.

### Estructura Temática (14 diapositivas)

| Sección | Diapositivas | Tema |
|---------|:---:|------|
| **Introducción** | 1–2 | Bienvenida, contexto de capacitación ARUs |
| **Esquemas de Red** | 3–5 | Diagramas detallados: Red FTTH general, Inter-Netuno (Huawei), Netuno-Inter (FiberHome) |
| **Puntos Importantes** | 6–12 | Reglas operacionales, aprovisionamiento, estados de ONU, pruebas de velocidad |
| **Cierre** | 13–14 | Agradecimiento |

### Relación con Archivo 1
Este archivo es un **resumen visual** del contenido de la capacitación. Contiene los mismos conceptos pero con **mayor énfasis en diagramas** y esquemas de conexión. Repite los puntos clave sobre:
- Las 2 etapas de aprovisionamiento
- Estados de ONU (Discovery → Whitelist → Aprovisionada)
- Reglas de modo Bridge
- Criterios de pruebas de velocidad

---

## 🔍 Hallazgos y Observaciones

### Contenido Valioso
1. **Arquitectura completa** de la red FTTH documentada con diagramas visuales
2. **Procedimientos operativos claros** para ARUs (técnicos de campo)
3. **Flujos de aprovisionamiento** bien definidos con estados intermedios
4. **Reglas de negocio críticas** sobre modos Bridge/Router

### Credenciales Documentadas

> [!WARNING]
> Se encontraron credenciales en texto plano en la Diapositiva 18 del archivo de capacitación:
> - URL: `http://soportearu.inter.com.ve/accounts/login/`
> - Usuario: `InterAru`
> - Clave: `Aru*Intercable2023`

### Formatos de Imagen
- **PNG**: Mayoría de imágenes (capturas de pantalla, diagramas editados)
- **JPG**: Fotos de hardware (módulos SFP/XFP, equipos)
- **WMF** (`.x-wmf`): Metaarchivos de Windows (diagramas vectoriales, iconos de red)

> [!TIP]
> Los archivos `.x-wmf` son metaarchivos de Windows y pueden no visualizarse en todos los visores. Si necesitas convertirlos a PNG, puedo crear un script adicional para ello.

---

## 📂 Ubicación de Archivos Extraídos

```
Documentación\Extraido\
├── Capacitacion FTTH\
│   ├── Capacitacion FTTH_contenido.md      (texto completo)
│   └── imagenes\                            (110 archivos)
│       ├── slide02_img001.png ... slide22_img110.png
│
└── EsquemaOLT_SW_815_FTTH_General v2\
    ├── EsquemaOLT_SW_815_FTTH_General v2_contenido.md  (texto completo)
    └── imagenes\                            (61 archivos)
        ├── slide03_img001.x-wmf ... slide11_img061.png
```
