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
    
    # Usuarios (12 colaboradores)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        area TEXT NOT NULL,
        role TEXT NOT NULL,
        avatar TEXT,
        shift TEXT DEFAULT 'Mañana',
        status TEXT DEFAULT 'Activo'
    )
    """)
    
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
    
    
    # Migración de columnas para el Worker de Correo
    cursor.execute("PRAGMA table_info(email_tickets)")
    columns = [col[1] for col in cursor.fetchall()]
    if "message_id" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN message_id TEXT")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tickets_msgid ON email_tickets(message_id)")
    if "source" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN source TEXT DEFAULT 'MANUAL'")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()