from services.mail_worker import mail_worker_instance
from services.reports import get_managerial_summary, generate_excel_report
from services.email_parser import TelcoEmailParser
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional
import sqlite3
import os
from datetime import datetime
from database import get_db, init_db

app = FastAPI(title="Operaciones IP - Dashboard de Métricas y Puntos por Área")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

@app.on_event("startup")
def startup_event():
    init_db()
    mail_worker_instance.start()

@app.get("/", response_class=FileResponse)
def dashboard_view():
    return FileResponse(os.path.join(BASE_DIR, "templates", "dashboard.html"))

def parse_area_filter(area: str, table_prefix: str = ""):
    col = f"{table_prefix}.area" if table_prefix else "area"
    if not area or area in ["Todas", "Todas las Áreas", "Todas las Células"]:
        return "1=1", []
    elif area in ["Acceso", "Redes de Acceso"]:
        return f"{col} IN ('Soporte', 'Cabecera')", []
    elif area in ["Servicios", "Servicios y Clientes", "Otras"]:
        return f"{col} IN ('Telefonía')", []
    else:
        return f"{col} = ?", [area]

# =============================================================
# ENDPOINTS DE KPIS Y GRÁFICAS FILTRADOS POR ÁREA
# =============================================================

@app.get("/api/kpis")
def get_kpis(area: str = "Todas"):
    conn = get_db()
    cur = conn.cursor()
    
    where_logs, params_logs = parse_area_filter(area)
    cur.execute(f"SELECT COUNT(*), COALESCE(SUM(points), 0), COALESCE(AVG(net_duration), 0) FROM task_logs WHERE {where_logs}", params_logs)
    row = cur.fetchone()
    total_tasks, total_points, avg_mttr = row[0], row[1], round(row[2], 1)
    
    cur.execute("SELECT area, SUM(points) FROM task_logs GROUP BY area")
    points_by_area = {r[0]: r[1] for r in cur.fetchall()}
    
    where_users, params_users = parse_area_filter(area)
    cur.execute(f"SELECT COUNT(*) FROM users WHERE {where_users}", params_users)
    total_techs = cur.fetchone()[0] or 1
    
    avg_points_per_tech = round(total_points / total_techs, 1) if total_techs > 0 else 0
    
    if avg_points_per_tech <= 25:
        balance_status = "Carga Equilibrada"
        balance_badge = "success"
    elif avg_points_per_tech <= 45:
        balance_status = "Carga Moderada"
        balance_badge = "warning"
    else:
        balance_status = "Carga Alta / Alerta"
        balance_badge = "danger"
        
    conn.close()
    return {
        "total_points": total_points,
        "total_tasks": total_tasks,
        "avg_mttr": avg_mttr,
        "total_techs": total_techs,
        "avg_points_per_tech": avg_points_per_tech,
        "balance_status": balance_status,
        "balance_badge": balance_badge,
        "points_by_area": points_by_area
    }

@app.get("/api/charts/technicians")
def get_technicians_chart(area: str = "Todas"):
    conn = get_db()
    cur = conn.cursor()
    
    where_clause, params = parse_area_filter(area, "u")
    cur.execute(f"""
    SELECT u.id, u.name, u.area, u.role, u.avatar,
           COALESCE(SUM(tl.points), 0) as total_pts,
           COUNT(tl.id) as total_tasks,
           COALESCE(AVG(tl.net_duration), 0) as avg_mttr
    FROM users u
    LEFT JOIN task_logs tl ON u.id = tl.user_id
    WHERE {where_clause}
    GROUP BY u.id
    ORDER BY total_pts DESC
    """, params)
    
    data = []
    for r in cur.fetchall():
        pts = r["total_pts"]
        if pts < 20:
            status = "Baja Carga"
            color = "#A0AEC0"
        elif pts <= 38:
            status = "Óptimo"
            color = "#10B981"
        elif pts <= 50:
            status = "Carga Alta"
            color = "#F59E0B"
        else:
            status = "Saturado"
            color = "#EF4444"
            
        data.append({
            "id": r["id"],
            "name": r["name"],
            "area": r["area"],
            "role": r["role"],
            "avatar": r["avatar"],
            "points": pts,
            "tasks": r["total_tasks"],
            "avg_mttr": round(r["avg_mttr"], 1),
            "status": status,
            "color": color
        })
        
    conn.close()
    return data

@app.get("/api/charts/task-weights")
def get_task_weights(area: str = "Todas"):
    conn = get_db()
    cur = conn.cursor()
    
    where_clause, params = parse_area_filter(area)
    
    cur.execute(f"""
    SELECT 
        CASE 
            WHEN points = 1 THEN 'P1 (1 pt - Consulta)'
            WHEN points = 2 THEN 'P2 (2 pts - Estándar)'
            WHEN points = 3 THEN 'P3 (3 pts - Intermedio)'
            WHEN points = 5 THEN 'P4 (5 pts - Complejo)'
            WHEN points = 8 THEN 'P5 (8 pts - Crítico)'
            ELSE 'Otros'
        END as weight_category,
        COUNT(*) as count,
        SUM(points) as points
    FROM task_logs
    WHERE {where_clause}
    GROUP BY points
    ORDER BY points ASC
    """, params)
    
    data = [{"category": r[0], "count": r[1], "points": r[2]} for r in cur.fetchall()]
    conn.close()
    return data

@app.get("/api/charts/hourly")
def get_hourly_chart(area: str = "Todas"):
    if area == "Soporte":
        pointsData = [15, 32, 58, 85, 110, 132, 150, 168]
    elif area == "Cabecera":
        pointsData = [10, 25, 45, 70, 95, 115, 140, 162]
    elif area in ["Acceso", "Redes de Acceso"]:
        pointsData = [25, 57, 103, 155, 205, 247, 290, 330]
    elif area == "Telefonía":
        pointsData = [8, 20, 38, 62, 84, 102, 120, 138]
    else:
        pointsData = [33, 77, 141, 217, 289, 349, 410, 468]
    return {
        "labels": ["Hora 1", "Hora 2", "Hora 3", "Hora 4", "Hora 5", "Hora 6", "Hora 7", "Hora 8"],
        "data": pointsData
    }

@app.get("/api/feed")
def get_feed(area: str = "Todas"):
    conn = get_db()
    cur = conn.cursor()
    where_clause, params = parse_area_filter(area, "tl")
    
    cur.execute(f"""
    SELECT tl.ticket_code, u.name, u.area, u.avatar, tt.name as task_name, tl.points, tl.net_duration, tl.created_at
    FROM task_logs tl
    JOIN users u ON tl.user_id = u.id
    JOIN task_types tt ON tl.task_type_id = tt.id
    WHERE {where_clause}
    ORDER BY tl.created_at DESC
    LIMIT 7
    """, params)
    
    feed = []
    for r in cur.fetchall():
        feed.append({
            "ticket": r[0],
            "user": r[1],
            "area": r[2],
            "avatar": r[3],
            "task": r[4],
            "points": r[5],
            "duration": r[6],
            "time": r[7]
        })
    conn.close()
    return feed

# =============================================================
# WORKSPACE DE CORREO FSM: DETALLES, CRONÓMETRO Y AUTO-RESOLUCIÓN
# =============================================================

@app.get("/api/tickets/inbox")
def get_tickets_inbox(area: str = "Todas"):
    conn = get_db()
    cur = conn.cursor()
    where_clause, params = parse_area_filter(area, "et")
    
    cur.execute(f"""
    SELECT et.id, et.ticket_code, et.sender_email, et.subject, et.full_body, et.area,
           et.subscriber_code, et.serial_pon, et.node_name, et.slot_pon, et.mac_address,
           et.status, et.claimed_by_user_id, u.name as claimed_by_name, u.avatar as claimed_avatar,
           et.claimed_at, et.total_paused_seconds,
           tt.name as suggested_task_name, tt.points as suggested_points, tt.id as suggested_task_id, tt.code as task_code,
           et.created_at, et.source
    FROM email_tickets et
    LEFT JOIN users u ON et.claimed_by_user_id = u.id
    LEFT JOIN task_types tt ON et.suggested_task_type_id = tt.id
    WHERE {where_clause}
    ORDER BY CASE et.status WHEN 'EN PROGRESO' THEN 1 WHEN 'PENDIENTE' THEN 2 ELSE 3 END, et.created_at DESC
    """, params)
    
    tickets = [dict(r) for r in cur.fetchall()]
    conn.close()
    return tickets

@app.get("/api/tickets/{ticket_id}")
def get_ticket_detail(ticket_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT et.*, u.name as claimed_by_name, u.avatar as claimed_avatar,
           tt.name as task_name, tt.points as task_points, tt.code as task_code, tt.sla_minutes
    FROM email_tickets et
    LEFT JOIN users u ON et.claimed_by_user_id = u.id
    LEFT JOIN task_types tt ON et.suggested_task_type_id = tt.id
    WHERE et.id = ?
    """, (ticket_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return JSONResponse(status_code=404, content={"error": "Ticket no encontrado"})
    return dict(row)

class ClaimTicketPayload(BaseModel):
    user_id: int

@app.post("/api/tickets/{ticket_id}/claim")
def claim_ticket(ticket_id: int, payload: ClaimTicketPayload):
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("SELECT status FROM email_tickets WHERE id = ?", (ticket_id,))
    row = cur.fetchone()
    if not row:
        return JSONResponse(status_code=404, content={"error": "Ticket no encontrado"})
    if row[0] == "EN PROGRESO":
        return JSONResponse(status_code=400, content={"error": "El ticket ya está en atención"})
        
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("""
    UPDATE email_tickets
    SET status = 'EN PROGRESO', claimed_by_user_id = ?, claimed_at = ?, total_paused_seconds = 0
    WHERE id = ?
    """, (payload.user_id, now_str, ticket_id))
    
    conn.commit()
    conn.close()
    return {"status": "ok", "claimed_at": now_str}

@app.post("/api/tickets/{ticket_id}/pause")
def pause_ticket(ticket_id: int):
    conn = get_db()
    cur = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("UPDATE email_tickets SET status = 'EN ESPERA', paused_at = ? WHERE id = ? AND status = 'EN PROGRESO'", (now_str, ticket_id))
    conn.commit()
    conn.close()
    return {"status": "ok", "paused_at": now_str}

@app.post("/api/tickets/{ticket_id}/resume")
def resume_ticket(ticket_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT paused_at, total_paused_seconds FROM email_tickets WHERE id = ?", (ticket_id,))
    row = cur.fetchone()
    if row and row[0]:
        try:
            paused_time = datetime.strptime(row[0], "%Y-%m-%d %H:%M:%S")
            pause_delta = int((datetime.now() - paused_time).total_seconds())
        except:
            pause_delta = 0
        new_total_paused = (row[1] or 0) + max(0, pause_delta)
        cur.execute("UPDATE email_tickets SET status = 'EN PROGRESO', paused_at = NULL, total_paused_seconds = ? WHERE id = ?", (new_total_paused, ticket_id))
        conn.commit()
    conn.close()
    return {"status": "ok"}

class AutoCompleteTicketPayload(BaseModel):
    resolution_notes: str
    task_type_id: Optional[int] = None

@app.post("/api/tickets/{ticket_id}/complete")
def complete_ticket_automated(ticket_id: int, payload: AutoCompleteTicketPayload):
    """
    CRONOMETRAJE 100% AUTOMATIZADO:
    Calcula la duración exacta transcurrida desde claimed_at hasta ahora,
    descontando automáticamente el tiempo en pausa (esperas de terreno).
    """
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("""
    SELECT et.ticket_code, et.claimed_by_user_id, et.area, et.claimed_at, et.total_paused_seconds, et.suggested_task_type_id
    FROM email_tickets et
    WHERE et.id = ?
    """, (ticket_id,))
    row = cur.fetchone()
    if not row:
        return JSONResponse(status_code=404, content={"error": "Ticket no encontrado"})
        
    ticket_code, user_id, area, claimed_at_str, total_paused_sec, default_task_id = row[0], row[1], row[2], row[3], row[4] or 0, row[5]
    
    # 1. CÁLCULO AUTOMÁTICO DE TIEMPO
    now = datetime.now()
    if claimed_at_str:
        try:
            claimed_dt = datetime.strptime(claimed_at_str, "%Y-%m-%d %H:%M:%S")
            raw_seconds = (now - claimed_dt).total_seconds()
        except:
            raw_seconds = 60
    else:
        raw_seconds = 60
        
    net_seconds = max(30, raw_seconds - total_paused_sec)
    duration_min = max(1, round(raw_seconds / 60))
    wait_min = round(total_paused_sec / 60)
    net_min = max(1, round(net_seconds / 60))
    
    # 2. PUNTOS ASIGNADOS AUTOMÁTICAMENTE
    task_type_id = payload.task_type_id or default_task_id or 1
    cur.execute("SELECT points, name FROM task_types WHERE id = ?", (task_type_id,))
    tt_row = cur.fetchone()
    points = tt_row[0] if tt_row else 2
    task_name = tt_row[1] if tt_row else "Operación Estándar"
    
    # 3. ACTUALIZAR ESTADO FSM
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("""
    UPDATE email_tickets
    SET status = 'COMPLETADO', completed_at = ?
    WHERE id = ?
    """, (now_str, ticket_id))
    
    # 4. REGISTRAR TAREA Y SUMAR PUNTOS AUTOMÁTICAMENTE AL OPERADOR
    cur.execute("""
    INSERT INTO task_logs (ticket_code, user_id, task_type_id, description, points, duration_minutes, wait_minutes, net_duration, area, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (ticket_code, user_id or 1, task_type_id, f"Resuelto vía correo: {task_name} ({payload.resolution_notes})", points, duration_min, wait_min, net_min, area, now_str))
    
    conn.commit()
    conn.close()
    return {
        "status": "ok",
        "ticket": ticket_code,
        "points": points,
        "duration_minutes": duration_min,
        "net_minutes": net_min,
        "wait_minutes": wait_min
    }

@app.post("/api/tickets/simulate-incoming")
def simulate_incoming_ticket(area: Optional[str] = "Soporte"):
    conn = get_db()
    cur = conn.cursor()
    import random
    code = f"INC-{random.randint(50000, 99999)}"
    
    templates = {
        "Soporte": [
            ("cuadrilla.centro@inter.com.ve", "Cliente con ONT en Discovery permanente - Nodo Centro", 
             "Abonado FHTT88129031 con potencia normal (-18.5 dBm) no es reconocido por la OLT en Whitelist. Requiere desatasco de demonio.",
             "CLI-884910", "FHTT88129031", "OLT-CCS-01", "Slot 4 / PON 8 / Ct.Onu 12", "C4:A8:1D:99:32:10", 5),
            ("soporte.empresas@inter.com.ve", "Cliente IP Certificada sin tráfico / Modo Bridge", 
             "Cliente corporativo con servicio simétrico. ONT en Bridge conectada a Fortigate del abonado. Verificar WANMAC en servidor 815. NO refrescar.",
             "CORP-109283", "HWTC55192033", "OLT-CHAC-01", "Slot 1 / PON 3 / Ct.Onu 5", "00:09:0F:77:21:A4", 7),
        ],
        "Cabecera": [
            ("monitoreo.core@inter.com.ve", "Alerta de saturación interfaz XFP OLT-01 al 79%", 
             "Tráfico pico sostenido sobre 7.9 Gbps. Requiere planificar PortChannel 20G.",
             "N/A", "N/A", "OLT-CCS-01", "Slot Uplink 1", "N/A", 14),
        ],
        "Telefonía": [
            ("soporte.clientes@inter.com.ve", "Registro SIP fallido en ONT FiberHome con VoIP", 
             "ONT reporta SIP status 403 Forbidden tras cambio de firmware.",
             "CLI-339182", "FHTT66192830", "OLT-VAL-01", "Slot 2 / PON 4", "N/A", 16),
        ]
    }
    
    if area in ["Acceso", "Redes de Acceso"]:
        target_area = random.choice(["Soporte", "Cabecera"])
    elif area in templates:
        target_area = area
    else:
        target_area = "Soporte"
    sample = random.choice(templates[target_area])
    
    cur.execute("""
    INSERT INTO email_tickets (ticket_code, sender_email, subject, full_body, area, subscriber_code, serial_pon, node_name, slot_pon, mac_address, suggested_task_type_id, status, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', 'SIMULADOR')
    """, (code, sample[0], sample[1], sample[2], target_area, sample[3], sample[4], sample[5], sample[6], sample[7], sample[8]))
    
    conn.commit()
    conn.close()
    return {"status": "ok", "ticket": code, "area": target_area}
# =============================================================
# ENDPOINTS DEL ALGORITMO DE PARSING DE CASOS REALES
# =============================================================

class AnalyzePayload(BaseModel):
    raw_text: str

@app.post("/api/parser/analyze")
def analyze_raw_email(payload: AnalyzePayload):
    """
    Ejecuta el algoritmo determinista y heurístico de extracción sobre texto 
    libre de un correo de soporte real.
    """
    extracted = TelcoEmailParser.parse(payload.raw_text)
    return {"status": "ok", "parsed": extracted}

class IngestCustomPayload(BaseModel):
    sender_email: str
    subject: str
    body_text: str

@app.post("/api/tickets/ingest-custom")
def ingest_custom_email(payload: IngestCustomPayload):
    """
    Ingesta un correo real, ejecuta el algoritmo de parsing y distribuye 
    automáticamente los datos en la base de datos de tickets de la FSM.
    """
    conn = get_db()
    cur = conn.cursor()
    
    # 1. Ejecutar Algoritmo de Extracción
    full_content = f"{payload.subject}\n{payload.body_text}"
    p = TelcoEmailParser.parse(full_content)
    
    # 2. Obtener ID de tarea correspondiente a la complejidad sugerida
    cur.execute("SELECT id FROM task_types WHERE code = ?", (p["suggested_task_code"],))
    row = cur.fetchone()
    task_type_id = row[0] if row else 1
    
    import random
    code = f"INC-{random.randint(60000, 99999)}"
    
    cur.execute("""
    INSERT INTO email_tickets (
        ticket_code, sender_email, subject, full_body, area, 
        subscriber_code, serial_pon, node_name, slot_pon, mac_address, 
        suggested_task_type_id, status, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', 'MANUAL')
    """, (
        code, payload.sender_email, payload.subject, payload.body_text, p["detected_area"],
        p["subscriber_code"] or "N/A", p["serial_pon"] or "N/A", p["node_name"] or "N/A", 
        p["slot_pon"] or "N/A", p["mac_address"] or "N/A", task_type_id
    ))
    
    conn.commit()
    conn.close()
    return {"status": "ok", "ticket_code": code, "parsed": p}

# =============================================================
# ENDPOINTS DE REPORTES GERENCIALES Y AUDITORÍA
# =============================================================

@app.get("/api/reports/summary")
def get_reports_summary_endpoint(area: str = "Todas", range_filter: str = "all"):
    """
    Retorna métricas consolidadas, KPIs de productividad, balance por célula
    y ranking de los especialistas para la vista previa en el dashboard.
    """
    return get_managerial_summary(area=area, range_filter=range_filter)

@app.get("/api/reports/export/excel")
def export_reports_excel_endpoint(area: str = "Todas", range_filter: str = "all"):
    """
    Genera y descarga en 1 clic el libro Excel corporativo (.xlsx) con 3 hojas:
    1. Resumen Ejecutivo y Áreas
    2. Productividad por Especialista
    3. Log Detallado de Auditoría Técnica
    """
    stream = generate_excel_report(area=area, range_filter=range_filter)
    filename = f"Reporte_Gerencial_Operaciones_IP_{area}_{range_filter}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# =============================================================
# ENDPOINTS DE USUARIOS Y GESTIÓN DE ACCESO (MÓDULO DE AUTENTICACIÓN)
# =============================================================

@app.get("/api/users")
def list_users(area: Optional[str] = "Todas"):
    """Retorna la lista de usuarios y roles activos en el sistema de manera dinámica"""
    conn = get_db()
    cur = conn.cursor()
    where_clause, params = parse_area_filter(area)
    cur.execute(f"SELECT id, name, area, role, avatar, shift, status, email FROM users WHERE {where_clause} ORDER BY id ASC", params)
    users = [dict(r) for r in cur.fetchall()]
    conn.close()
    return users

@app.get("/api/auth/me")
def get_current_user_profile():
    """Retorna el perfil del usuario activo en la sesión"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, name, area, role, avatar, email FROM users WHERE role = 'ADMINISTRADOR' OR role = 'COORDINADOR' LIMIT 1")
    row = cur.fetchone()
    conn.close()
    if row:
        return dict(row)
    return {
        "id": 1,
        "name": "David Rodríguez",
        "area": "Redes de Acceso",
        "role": "COORDINADOR",
        "avatar": "DR",
        "email": "david.rodriguez@inter.com.ve"
    }

# =============================================================
# ENDPOINTS DEL WORKER DE CORREO (MODO SIMULADOR E IMAP REAL)
# =============================================================

@app.get("/api/mail-worker/status")
def get_mail_worker_status():
    """Retorna el estado de sincronización del worker en segundo plano"""
    return mail_worker_instance.get_status()

class ToggleWorkerPayload(BaseModel):
    enabled: bool

@app.post("/api/mail-worker/toggle")
def toggle_mail_worker(payload: ToggleWorkerPayload):
    """Activa o pausa la búsqueda automática en segundo plano"""
    mail_worker_instance.config["enabled"] = payload.enabled
    mail_worker_instance.save_config(mail_worker_instance.config)
    return {"status": "ok", "enabled": payload.enabled}

@app.post("/api/mail-worker/sync-now")
def sync_mail_worker_now():
    """Fuerza una sincronización inmediata sin esperar el intervalo"""
    res = mail_worker_instance.sync_now()
    return res

class MailWorkerConfigPayload(BaseModel):
    mode: str
    poll_interval: int
    imap_server: Optional[str] = "imap.gmail.com"
    imap_port: Optional[int] = 993
    imap_user: Optional[str] = ""
    imap_password: Optional[str] = ""
    imap_mailbox: Optional[str] = "INBOX"

@app.post("/api/mail-worker/config")
def update_mail_worker_config(payload: MailWorkerConfigPayload):
    """Actualiza los parámetros de conexión y modo de trabajo"""
    cfg = {
        "mode": payload.mode,
        "poll_interval": payload.poll_interval,
        "imap_server": payload.imap_server,
        "imap_port": payload.imap_port,
        "imap_user": payload.imap_user,
        "imap_mailbox": payload.imap_mailbox
    }
    if payload.imap_password:
        cfg["imap_password"] = payload.imap_password
    mail_worker_instance.save_config(cfg)
    return {"status": "ok", "config": mail_worker_instance.get_status()}
