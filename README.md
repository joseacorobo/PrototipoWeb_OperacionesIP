# 🚀 Operaciones IP — Plataforma de Gestión de Carga, Métricas DERS y Automatización FSM

Sistema web integral de gestión operativa, balanceo de carga de trabajo, medición de KPIs bajo estándar DERS y trazabilidad forense para el departamento de **Operaciones IP** de **Inter Telecomunicaciones** (Red FTTH).

---

## 🏢 1. Arquitectura y Jerarquía Organizacional

La plataforma modela la estructura jerárquica de la empresa:

- **Departamento General:** Operaciones IP
  - **División Operativa (Alcance Activo FTTH):** Redes de Acceso y Aprovisionamiento
    - 🎧 **Célula de Soporte FTTH** (4 Especialistas)
    - 🖥️ **Célula de Cabecera OLT** (4 Especialistas)
    - 📞 **Célula de Telefonía VoIP / SIP** (4 Especialistas)
  - **Otras Divisiones (Previstas para Expansión - Fase 3):**
    - 🏢 **Grandes Cuentas** (Clientes Corporativos / Enlaces Dedicados)
    - ⚡ **Redes WAN & Core** (Transporte IP / BGP / Backhaul)

---

## ✨ 2. Funcionalidades Principales

### 📈 Motor de Métricas y Ponderación por Puntos (DERS)
- Asignación de puntos ponderados por dificultad de tarea:
  - **P1 (1 pt):** Verificación de estado de ONT en OLT / Consultas simples.
  - **P2 (2 pts):** Resolución de discrepancia MAC / Pruebas de velocidad.
  - **P3 (3 pts):** Desatasco de demonio OLT (VLAN / Whitelist) / Sustitución SFP.
  - **P4 (5 pts):** Soporte a Modo Bridge con IP Certificada / Diagnóstico Jitter & MOS VoIP.
  - **P5 (8 pts):** Habilitación PortChannel 10G ➔ 20G / Contingencias troncales.
- Medición de saturación por especialista y velocímetro de balance del área (Equilibrada, Moderada, Alta).
- Gráficos interactivos en tiempo real con Chart.js (Curvas spline horarias y gráficos de dona por complejidad).

### ⏱️ Workspace de Atención y Cronometraje 100% Automatizado
- **Cero ingreso manual de tiempos:** Al abrir un correo (`Atender`), el backend registra `claimed_at = now()` e inicia un cronómetro en vivo (`HH:MM:SS`).
- **Botón de Pausa (En Espera de Terreno):** Permite pausar el ticket si la cuadrilla de terreno debe revisar acometida o drop. El tiempo en pausa se descuenta automáticamente del MTTR.
- **Bloqueo Concurrente FSM:** Impide que dos analistas atiendan el mismo ticket al mismo tiempo.

### 🧠 Algoritmo de Extracción de Casos Reales (`TelcoEmailParser`)
Procesamiento heurístico y determinista de correos de soporte sin dependencias de LLM ni costos externos:
- **Número de Abonado (10 Dígitos):** Extrae el código de 10 dígitos y detecta automáticamente el **Permisor** asociado (primeros 2 dígitos, ej. `P-10`, `P-25`).
- **Serial PON (12 Caracteres):** Discrimina el fabricante y la topología:
  - `FHTT...` ➔ FiberHome (Red Inter)
  - `HWTC...` ➔ Huawei (Red Netuno)
  - `STV...` / Otros ➔ SimpleTV / Terceros
- **Nombre Canónico de OLT:** Normaliza entradas libres (`OLT CCS 01`, `OLT VAL 02`) al formato oficial `OLT-CCS-01`.
- **Posición OLT:** Si el correo no incluye Slot/PON, asigna inteligentemente: *"Consultar en OLT vía Serial PON"*.
- **Alerta de Seguridad en Modo Bridge:** Si detecta términos de IP Certificada o Bridge, despliega una alerta crítica que prohíbe comandos de *Refresh* o *Reaprovisionamiento*.

### 📊 Módulo de Reportes Gerenciales y Auditoría Forense
- Panel de supervisión interactivo con filtros por período (*Todo, Mes Actual, Últimos 7d, Hoy*) y célula.
- **Exportación en 1 clic a Excel (`.xlsx`)** mediante `openpyxl` con 3 pestañas:
  1. *Resumen Ejecutivo y Células:* KPIs globales, balance comparativo y % de esfuerzo.
  2. *Productividad Especialistas:* Detalle de los 12 analistas con desglose P1-P5 y semáforos de saturación.
  3. *Log Detallado de Auditoría:* Trazabilidad completa ticket por ticket con tiempos netos, datos técnicos y notas de diagnóstico.

---

## 📂 3. Estructura del Repositorio

```text
├── app/
│   ├── main.py                  # API FastAPI y enrutamiento de vistas
│   ├── database.py              # Inicialización SQLite y conexión
│   ├── seed.py                  # Poblador de datos de prueba (12 técnicos, tareas, catálogo DERS)
│   ├── services/
│   │   ├── email_parser.py      # Algoritmo de extracción de entidades técnicas
│   │   └── reports.py           # Agregación SQL y generador Excel multi-hoja
│   ├── static/
│   │   ├── css/snow_ui.css      # Sistema de diseño SnowUI
│   │   └── js/dashboard.js      # Controlador SPA, cronómetros y llamadas asíncronas
│   └── templates/
│       └── dashboard.html       # Dashboard gerencial, modal de workspace y reportes
├── Documentación/               # Esquemas de red, capacitaciones FTTH y matrices DERS
├── requirements.txt             # Dependencias del proyecto
├── .gitignore                   # Exclusión de binarios y temporales
└── README.md                    # Documentación técnica del proyecto
```

---

## ⚙️ 4. Instalación y Puesta en Marcha

### Prerrequisitos
- Python 3.10 o superior instalado.
- Git instalado.

### Paso 1: Clonar el Repositorio
```bash
git clone <URL_DEL_REPOSITORIO>
cd Levantamiento
```

### Paso 2: Crear y Activar Entorno Virtual (Opcional pero recomendado)
```bash
python -m venv venv
# En Windows:
venv\Scripts\activate
# En Linux/Mac:
source venv/bin/activate
```

### Paso 3: Instalar Dependencias
```bash
pip install -r requirements.txt
```

### Paso 4: Inicializar y Poblar la Base de Datos
```bash
python app/seed.py
```

### Paso 5: Iniciar el Servidor de Desarrollo
```bash
uvicorn main:app --app-dir app --reload --host 127.0.0.1 --port 8000
```

Abre tu navegador en:  
👉 **http://127.0.0.1:8000**

---

## 👥 Especialistas del Sistema (12 Técnicos - Carga Equilibrada)

| Célula / Área | Especialistas | Rol Funcional |
| :--- | :--- | :--- |
| **Soporte FTTH** | Carlos Méndez (CM), Ana Silva (AS), Roberto Gómez (RG), Laura Peña (LP) | Diagnóstico ONT, Whitelist, Demonios, Bridging |
| **Cabecera OLT** | Manuel Torres (MT), Diego Ramos (DR), Patricia Castro (PC), Javier Morales (JM) | Enlaces troncales, SFP, PortChannels 20G |
| **Telefonía VoIP**| Sofía Rivas (SR), Andrés Blanco (AB), Elena Pardo (EP), Gabriel Marcano (GM) | Servidores SIP, Dialplans, MOS y Jitter |

---

## 📄 Licencia y Confidencialidad
Desarrollado para uso exclusivo de **Operaciones IP — Inter Telecomunicaciones**. Todos los derechos reservados.
