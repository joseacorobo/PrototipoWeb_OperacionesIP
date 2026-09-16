import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ip_ops.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Usuarios y Roles (Soporta Autenticación RBAC y Cuentas de Acceso)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        area TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ESPECIALISTA', -- ADMINISTRADOR, COORDINADOR, ESPECIALISTA
        avatar TEXT,
        shift TEXT DEFAULT 'Mañana',
        status TEXT DEFAULT 'Activo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Migración segura de columnas en users
    cursor.execute("PRAGMA table_info(users)")
    existing_user_cols = [c[1] for c in cursor.fetchall()]
    if "email" not in existing_user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN email TEXT")
    if "password_hash" not in existing_user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
    if "created_at" not in existing_user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN created_at TIMESTAMP")
    
    # Catálogo de Tareas P1 a P5
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS task_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        area TEXT NOT NULL,
        points INTEGER NOT NULL,
        sla_minutes INTEGER NOT NULL,
        description TEXT
    )
    """)
    
    # Tickets de Correo con Parámetros Técnicos Extraídos y Tiempos de Cronómetro
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS email_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_code TEXT UNIQUE NOT NULL,
        sender_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        full_body TEXT NOT NULL,
        area TEXT NOT NULL,
        subscriber_code TEXT,
        serial_pon TEXT,
        node_name TEXT,
        slot_pon TEXT,
        mac_address TEXT,
        suggested_task_type_id INTEGER,
        status TEXT DEFAULT 'PENDIENTE', -- PENDIENTE, EN PROGRESO, EN ESPERA, COMPLETADO
        folder TEXT DEFAULT 'INBOX',
        claimed_by_user_id INTEGER,
        claimed_at TIMESTAMP,
        paused_at TIMESTAMP,
        total_paused_seconds INTEGER DEFAULT 0,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (claimed_by_user_id) REFERENCES users(id),
        FOREIGN KEY (suggested_task_type_id) REFERENCES task_types(id)
    )
    """)
    
    # Registro Histórico de Tareas (Duración 100% calculada por el sistema)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS task_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_code TEXT,
        user_id INTEGER NOT NULL,
        task_type_id INTEGER NOT NULL,
        description TEXT,
        points INTEGER NOT NULL,
        duration_minutes INTEGER NOT NULL,
        wait_minutes INTEGER DEFAULT 0,
        net_duration INTEGER NOT NULL,
        area TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (task_type_id) REFERENCES task_types(id)
    )
    """)
    
    
    # Registro de Auditoría Forense y Trazabilidad en Tiempo Real
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT NOT NULL,
        user_role TEXT NOT NULL,
        area TEXT NOT NULL,
        action TEXT NOT NULL, -- INICIO_SESION, CIERRE_SESION, CAMBIO_PERFIL, TOMA_TICKET, PAUSA_TICKET, REANUDACION_TICKET, CIERRE_TICKET, INGESTA_CORREO, CONFIG_IMAP
        entity_type TEXT NOT NULL, -- AUTH, TICKET, MAIL_WORKER, SISTEMA
        entity_id TEXT,
        details TEXT,
        ip_address TEXT DEFAULT '127.0.0.1',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)")
    
    # Migración de columnas para audit_logs
    cursor.execute("PRAGMA table_info(audit_logs)")
    audit_cols = [col[1] for col in cursor.fetchall()]
    if "user_area" not in audit_cols:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN user_area TEXT")
    if "area" not in audit_cols:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN area TEXT")
    if "target_type" not in audit_cols:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN target_type TEXT")
    if "entity_type" not in audit_cols:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN entity_type TEXT")
    if "target_id" not in audit_cols:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN target_id TEXT")
    if "entity_id" not in audit_cols:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN entity_id TEXT")
    
    # Migración de columnas para el Worker de Correo y Correos Directos
    cursor.execute("PRAGMA table_info(email_tickets)")
    columns = [col[1] for col in cursor.fetchall()]
    if "message_id" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN message_id TEXT")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tickets_msgid ON email_tickets(message_id)")
    if "source" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN source TEXT DEFAULT 'MANUAL'")
    if "recipient_email" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN recipient_email TEXT")
    if "html_body" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN html_body TEXT")
    if "folder" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN folder TEXT DEFAULT 'INBOX'")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_tickets_folder ON email_tickets(folder)")

    # Tabla de Adjuntos, Membretes e Imágenes Inline
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ticket_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content_id TEXT,
        is_inline BOOLEAN DEFAULT 0,
        file_size INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES email_tickets(id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON ticket_attachments(ticket_id)")

    # Tabla de Respuestas Enviadas vía Web / SMTP
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS email_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        recipient_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_html TEXT NOT NULL,
        body_text TEXT NOT NULL,
        status TEXT DEFAULT 'ENVIADO',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES email_tickets(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_replies_ticket ON email_replies(ticket_id)")

    # Asegurar existencia de usuario José Corobo como especialista para validación real
    cursor.execute("SELECT id FROM users WHERE email = 'joseacorobo@gmail.com'")
    jc = cursor.fetchone()
    if not jc:
        import hashlib
        pass_hash = hashlib.sha256("admin".encode("utf-8")).hexdigest()
        cursor.execute("""
        INSERT INTO users (name, email, password_hash, area, role, avatar, shift, status)
        VALUES ('José Corobo', 'joseacorobo@gmail.com', ?, 'Soporte', 'ESPECIALISTA', 'JC', 'Mañana', 'Activo')
        """, (pass_hash,))

    conn.commit()
    conn.close()

    # Auto-seed para despliegues nuevos (si el catálogo de tareas está vacío)
    conn_check = get_db()
    cur_check = conn_check.cursor()
    cur_check.execute("SELECT COUNT(*) FROM task_types")
    needs_seed = (cur_check.fetchone()[0] == 0)
    conn_check.close()

    if needs_seed:
        try:
            try:
                from seed import seed
            except ImportError:
                from app.seed import seed
            seed(skip_init=True)
        except Exception as seed_err:
            print(f"Aviso en auto-seed de base de datos: {seed_err}")

if __name__ == "__main__":
    init_db()