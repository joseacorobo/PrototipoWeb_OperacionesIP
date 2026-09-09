from database import get_db, init_db
import random
from datetime import datetime, timedelta

def seed():
    init_db()
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("DELETE FROM task_logs")
    cur.execute("DELETE FROM email_tickets")
    cur.execute("DELETE FROM task_types")
    cur.execute("DELETE FROM users")
    
    import hashlib
    default_hash = hashlib.sha256("inter2026".encode('utf-8')).hexdigest()
    
    # 1. Especialistas y Coordinadores Operacionales
    users = [
        ("Carlos Méndez", "Soporte", "COORDINADOR", "CM", "Mañana", "Activo", "carlos.mendez@inter.com.ve", default_hash),
        ("Anais Rodríguez", "Soporte", "ESPECIALISTA", "AR", "Mañana", "Activo", "anais.rodriguez@inter.com.ve", default_hash),
        ("José Gregorio Pérez", "Soporte", "ESPECIALISTA", "JP", "Tarde", "Activo", "jose.perez@inter.com.ve", default_hash),
        ("Mariana Salazar", "Soporte", "ESPECIALISTA", "MS", "Noche", "Activo", "mariana.salazar@inter.com.ve", default_hash),
        ("Luis Eduardo Gómez", "Cabecera", "COORDINADOR", "LG", "Mañana", "Activo", "luis.gomez@inter.com.ve", default_hash),
        ("Ricardo Morales", "Cabecera", "ESPECIALISTA", "RM", "Mañana", "Activo", "ricardo.morales@inter.com.ve", default_hash),
        ("Gabriel Torres", "Cabecera", "ESPECIALISTA", "GT", "Tarde", "Activo", "gabriel.torres@inter.com.ve", default_hash),
        ("Alejandro Silva", "Cabecera", "ESPECIALISTA", "AS", "Noche", "Activo", "alejandro.silva@inter.com.ve", default_hash),
        ("Daniela Castillo", "Telefonía", "COORDINADOR", "DC", "Mañana", "Activo", "daniela.castillo@inter.com.ve", default_hash),
        ("Jesús Alberto Vargas", "Telefonía", "ESPECIALISTA", "JV", "Mañana", "Activo", "jesus.vargas@inter.com.ve", default_hash),
        ("Paola Mendoza", "Telefonía", "ESPECIALISTA", "PM", "Tarde", "Activo", "paola.mendoza@inter.com.ve", default_hash),
        ("Víctor Hernández", "Telefonía", "ESPECIALISTA", "VH", "Noche", "Activo", "victor.hernandez@inter.com.ve", default_hash),
        ("David Rodríguez", "Acceso", "ADMINISTRADOR", "DR", "General", "Activo", "david.rodriguez@inter.com.ve", default_hash),
    ]
    cur.executemany("INSERT INTO users (name, area, role, avatar, shift, status, email, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", users)
    
    # 2. Catálogo de Tareas P1 a P5
    task_types = [
        ("P1-SOP-01", "Verificación Estado ONT (Discovery/Whitelist)", "Soporte", 1, 10, "Consulta de señal y estado L2"),
        ("P1-SOP-02", "Chequeo Potencia TX/RX en OLT", "Soporte", 1, 10, "Validación de atenuación óptica"),
        ("P2-SOP-01", "Prueba Oficial de Velocidad por CLI", "Soporte", 2, 20, "Test Speedtest puerto GE de ONT"),
        ("P2-SOP-02", "Resolución Discrepancia MAC (Roja a Verde)", "Soporte", 2, 25, "Corrección de MAC en BD 815"),
        ("P3-SOP-01", "Desatasco Demonio OLT (VLAN / Whitelist)", "Soporte", 3, 35, "Forzado de registro de abonado"),
        ("P3-SOP-02", "Traspaso de Puerto PON / Reemplazo Serial", "Soporte", 3, 40, "Migración de cliente FiberHome/Huawei"),
        ("P4-SOP-01", "Soporte a Modo Bridge con IP Certificada", "Soporte", 5, 60, "Configuración estricta sin refresh"),
        ("P4-SOP-02", "Remediación Bloqueo BD 815 / Pool IP Agotado", "Soporte", 5, 55, "Desbloqueo de cola de aprovisionamiento"),
        ("P5-SOP-01", "Atención y Recuperación Falla Tarjeta GCOB", "Soporte", 8, 120, "Restablecimiento masivo de PONs"),
        ("P1-CAB-01", "Lectura Telemetría Puerto Switch 10G", "Cabecera", 1, 15, "Revisión de consumo de tráfico"),
        ("P2-CAB-01", "Inspección y Limpieza de Patch Cord Óptico", "Cabecera", 2, 30, "Mantenimiento físico en rack"),
        ("P3-CAB-01", "Sustitución Módulo SFP-10G-SR en Switch", "Cabecera", 3, 45, "Reemplazo de transceptor con falla"),
        ("P4-CAB-01", "Reemplazo Tarjeta Controladora HSWA", "Cabecera", 5, 75, "Mantenimiento crítico de controladora"),
        ("P5-CAB-01", "Habilitación PortChannel 10G ➔ 20G en OLT/SW", "Cabecera", 8, 120, "Ampliación de capacidad troncal"),
        ("P5-CAB-02", "Armado y Certificación de Mini Red para OLT", "Cabecera", 8, 150, "Puesta en marcha de nuevo nodo"),
        ("P1-TEL-01", "Consulta Estado Registro SIP en Softswitch", "Telefonía", 1, 10, "Validación de registro activo"),
        ("P2-TEL-01", "Corrección Básica de Credenciales SIP", "Telefonía", 2, 20, "Reenvío de auth a la ONT"),
        ("P3-TEL-01", "Depuración Falla Señalización SIP / Timeout", "Telefonía", 3, 35, "Análisis de traza SIP Wireshark"),
        ("P4-TEL-01", "Diagnóstico Degradación MOS (<4.0) y Jitter", "Telefonía", 5, 60, "Análisis de QoS en VLAN de voz"),
        ("P5-TEL-01", "Restauración de Enlace Troncal SIP Call Server", "Telefonía", 8, 120, "Falla masiva de telefonía"),
    ]
    cur.executemany("INSERT INTO task_types (code, name, area, points, sla_minutes, description) VALUES (?, ?, ?, ?, ?, ?)", task_types)
    
    # 3. Tareas Históricas
    cur.execute("SELECT id, name, area FROM users")
    user_rows = cur.fetchall()
    cur.execute("SELECT id, code, name, area, points, sla_minutes FROM task_types")
    task_rows = cur.fetchall()
    task_by_area = {"Soporte": [], "Cabecera": [], "Telefonía": []}
    for t in task_rows:
        task_by_area[t[3]].append(t)
        
    logs = []
    base_time = datetime.now()
    for u in user_rows:
        u_id, u_name, u_area = u[0], u[1], u[2]
        if u_area not in task_by_area:
            continue
        area_tasks = task_by_area[u_area]
        for _ in range(random.randint(8, 13)):
            t = random.choice(area_tasks)
            t_id, t_code, t_name, t_pts, t_sla = t[0], t[1], t[2], t[4], t[5]
            dur = max(5, int(random.gauss(t_sla, t_sla * 0.2)))
            wait = random.choice([0, 5, 10]) if t_pts >= 3 else 0
            net = max(5, dur - wait)
            mins_ago = random.randint(15, 600)
            t_created = (base_time - timedelta(minutes=mins_ago)).strftime("%Y-%m-%d %H:%M:%S")
            logs.append((f"INC-{random.randint(10000, 99999)}", u_id, t_id, f"Resuelto vía correo: {t_name}", t_pts, dur, wait, net, u_area, t_created))
            
    cur.executemany("""
    INSERT INTO task_logs (ticket_code, user_id, task_type_id, description, points, duration_minutes, wait_minutes, net_duration, area, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, logs)
    
    # 4. Bandeja de Correos con Datos Técnicos Completos para el Soporte
    sample_emails = [
        (
            "INC-40112", "soporte.terreno@inter.com.ve", 
            "Cliente con ONT en Discovery permanente - Nodo Chacao", 
            "Buenas tardes equipo. El cliente reporta que tras reemplazo de cable drop la ONT emite y recibe potencia óptica normal (-19.2 dBm), pero no avanza a Whitelist. Se solicita desatascar demonio OLT y verificar homologación.",
            "Soporte", "CLI-902188", "FHTT09182312", "OLT-CHAC-01", "Slot 3 / PON 4 / Ct.Onu 18", "E0:67:B3:21:44:02", 5,
            "PENDIENTE", None, None
        ),
        (
            "INC-40115", "operaciones.aru@inter.com.ve", 
            "Abonado IP Certificada sin tráfico / Modo Bridge", 
            "Estimados. Se requiere revisión de cliente corporativo Empresa B. Tiene servicio de IP certificada bajo modo Bridge. La ONT tiene enlace PON arriba pero en el 815 la MAC aparece en ROJO. Por favor validar si la MAC cargada coincide con la WANMAC del router del abonado. RECORDATORIO: NO enviar refresh ni reaprovisionar.",
            "Soporte", "CORP-440192", "HWTC88291044", "OLT-CCS-01", "Slot 5 / PON 2 / Ct.Onu 7", "00:1A:2B:3C:4D:5E", 7,
            "EN PROGRESO", 1, (datetime.now() - timedelta(minutes=8)).strftime("%Y-%m-%d %H:%M:%S")
        ),
        (
            "INC-40118", "noc.core@inter.com.ve", 
            "Alerta tráfico Uplink OLT-CCS-02 al 78%", 
            "Alerta automática del sistema NMS. El enlace de 10G entre OLT-CCS-02 y el Switch de distribución ha sostenido 7.85 Gbps de tráfico pico por más de 45 minutos. Se requiere verificar módulos SFP/XFP y preparar activación de PortChannel a 20 Gbps.",
            "Cabecera", "N/A", "N/A", "OLT-CCS-02", "Slot Uplink 1", "N/A", 14,
            "PENDIENTE", None, None
        ),
        (
            "INC-40122", "soporte.voz@inter.com.ve", 
            "Falla de registro SIP masivo en Urbanización El Parral", 
            "Se detectan 14 ONTs FiberHome en el PON 6 que pasaron a estado 'Registro SIP fallido' (error 403 / Timeout). Se requiere validar el perfil de voz en la OLT y el demonio SIP en el Softswitch.",
            "Telefonía", "CLI-Varios", "FHTT-Múltiples", "OLT-VAL-01", "Slot 2 / PON 6", "N/A", 18,
            "PENDIENTE", None, None
        ),
    ]
    
    cur.executemany("""
    INSERT INTO email_tickets (ticket_code, sender_email, subject, full_body, area, subscriber_code, serial_pon, node_name, slot_pon, mac_address, suggested_task_type_id, status, claimed_by_user_id, claimed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, sample_emails)
    
    conn.commit()
    conn.close()
    print("Database seeded with rich technical email tickets.")

if __name__ == "__main__":
    seed()