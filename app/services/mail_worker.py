import threading
import time
import os
import json
import imaplib
import email
from email.header import decode_header
import random
from datetime import datetime

try:
    from database import get_db
    from services.email_parser import TelcoEmailParser
except ImportError:
    from app.database import get_db
    from app.services.email_parser import TelcoEmailParser

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config_mail.json")

DEFAULT_CONFIG = {
    "mode": "SIMULATOR",  # "SIMULATOR" o "REAL_IMAP"
    "enabled": True,
    "poll_interval": 30,  # segundos
    "imap_server": "imap.gmail.com",
    "imap_port": 993,
    "imap_user": "",
    "imap_password": "",
    "imap_mailbox": "INBOX"
}

class MailWorker:
    """
    Servicio en segundo plano para la ingesta continua de correos.
    Soporta dos modalidades:
    1. SIMULATOR: Genera periódicamente casos técnicos reales para pruebas controladas.
    2. REAL_IMAP: Conexión SSL a buzón corporativo, deduplicación por Message-ID y parsing.
    """
    
    def __init__(self):
        self.config = self.load_config()
        self._is_running = False
        self._thread = None
        self._stop_event = threading.Event()
        self.last_check = "Nunca"
        self.emails_processed = 0
        self.last_error = None

    def load_config(self) -> dict:
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    cfg = DEFAULT_CONFIG.copy()
                    cfg.update(saved)
                    return cfg
            except Exception:
                pass
        return DEFAULT_CONFIG.copy()

    def save_config(self, new_config: dict):
        self.config.update(new_config)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(self.config, f, indent=4)

    def start(self):
        if not self._is_running:
            self._is_running = True
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._run_loop, daemon=True)
            self._thread.start()

    def stop(self):
        self._is_running = False
        self._stop_event.set()

    def get_status(self) -> dict:
        return {
            "is_running": self._is_running,
            "mode": self.config.get("mode", "SIMULATOR"),
            "enabled": self.config.get("enabled", True),
            "poll_interval": self.config.get("poll_interval", 30),
            "last_check": self.last_check,
            "emails_processed": self.emails_processed,
            "last_error": self.last_error,
            "imap_server": self.config.get("imap_server", ""),
            "imap_user": self.config.get("imap_user", ""),
            "has_password": bool(self.config.get("imap_password", ""))
        }

    def _run_loop(self):
        while not self._stop_event.is_set():
            if self.config.get("enabled", True):
                try:
                    self.sync_now()
                except Exception as e:
                    self.last_error = str(e)
            
            interval = max(5, self.config.get("poll_interval", 30))
            self._stop_event.wait(interval)

    def sync_now(self) -> dict:
        self.last_check = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.last_error = None
        
        mode = self.config.get("mode", "SIMULATOR")
        if mode == "SIMULATOR":
            return self._sync_simulator()
        else:
            return self._sync_real_imap()

    def _sync_simulator(self) -> dict:
        """Modo simulador de laboratorio: genera un caso telco estructurado"""
        sample_cases = [
            {
                "sender": "cuadrilla.chacao@inter.com.ve",
                "subject": "Falla ONT Discovery permanente - Nodo Chacao",
                "body": f"Buenas tardes soporte, favor apoyo con AB {random.choice(['10', '25', '30'])}{random.randint(10000000, 99999999)} con serial FHTT{random.randint(10000000, 99999999)} en OLT-CHAC-01. La ONT emite -19.4 dBm pero no sube a Whitelist. Demonio atascado."
            },
            {
                "sender": "cuadrilla.centro@inter.com.ve",
                "subject": "Cliente IP Certificada sin tráfico / Modo Bridge",
                "body": f"Cliente corporativo con AB {random.choice(['10', '25', '30'])}{random.randint(10000000, 99999999)} serial HWTC{random.randint(10000000, 99999999)} en OLT-CCS-02. Modo bridge con IP certificada, validar WANMAC 00:1a:2b:{random.randint(10,99)}:{random.randint(10,99)}:{random.randint(10,99)} en 815."
            },
            {
                "sender": "monitoreo.core@inter.com.ve",
                "subject": "Alerta de saturación enlace troncal OLT",
                "body": "Alerta automática NOC: Enlace troncal OLT-CCS-01 slot uplink 1 saturado al 79.4% (7.9 Gbps). Planificar ampliación PortChannel 20G."
            },
            {
                "sender": "soporte.voip@inter.com.ve",
                "subject": "Falla registro SIP en ONT residencial",
                "body": f"AB {random.choice(['10', '25', '30'])}{random.randint(10000000, 99999999)} con serial FHTT{random.randint(10000000, 99999999)} en OLT-VAL-02 reporta SIP 403 Forbidden. Revisar dialplan."
            }
        ]
        
        selected = random.choice(sample_cases)
        msg_id = f"<sim-{int(time.time())}-{random.randint(1000,9999)}@inter.com.ve>"
        
        inserted_code = self._insert_ticket(
            message_id=msg_id,
            sender_email=selected["sender"],
            subject=selected["subject"],
            body_text=selected["body"],
            source="SIMULADOR"
        )
        
        if inserted_code:
            self.emails_processed += 1
            return {"status": "ok", "mode": "SIMULATOR", "ticket": inserted_code, "new_count": 1}
        return {"status": "ok", "mode": "SIMULATOR", "new_count": 0}

    def _sync_real_imap(self) -> dict:
        """Modo conexión IMAP real con servidor de correo"""
        server = self.config.get("imap_server")
        port = int(self.config.get("imap_port", 993))
        user = self.config.get("imap_user")
        password = self.config.get("imap_password")
        mailbox = self.config.get("imap_mailbox", "INBOX")

        if not user or not password:
            self.last_error = "Credenciales IMAP no configuradas."
            return {"status": "error", "message": self.last_error}

        new_tickets = []
        mail = None
        try:
            mail = imaplib.IMAP4_SSL(server, port)
            mail.login(user, password)
            mail.select(mailbox)

            status, messages = mail.search(None, "UNREAD")
            if status != "OK":
                return {"status": "ok", "new_count": 0}

            msg_ids = messages[0].split()
            for msg_id_bytes in msg_ids:
                res_fetch, msg_data = mail.fetch(msg_id_bytes, "(RFC822)")
                if res_fetch != "OK":
                    continue

                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                # 1. Message-ID para deduplicación
                message_id = msg.get("Message-ID") or f"<no-id-{int(time.time())}-{msg_id_bytes.decode()}@imap>"
                
                # 2. Decodificar Asunto
                subject = self._decode_header_str(msg.get("Subject", "Sin Asunto"))
                sender = self._decode_header_str(msg.get("From", "remitente@desconocido.com"))

                # 3. Extraer Cuerpo
                body = self._extract_body(msg)

                # 4. Ingestar y marcar como leído
                t_code = self._insert_ticket(
                    message_id=message_id,
                    sender_email=sender,
                    subject=subject,
                    body_text=body,
                    source="IMAP"
                )
                if t_code:
                    new_tickets.append(t_code)
                    self.emails_processed += 1
                    # Marcar como visto en el servidor IMAP
                    mail.store(msg_id_bytes, "+FLAGS", "\\Seen")

            mail.close()
            mail.logout()
            return {"status": "ok", "mode": "REAL_IMAP", "new_count": len(new_tickets), "tickets": new_tickets}

        except Exception as e:
            self.last_error = str(e)
            if mail:
                try:
                    mail.logout()
                except Exception:
                    pass
            return {"status": "error", "message": str(e)}

    def _insert_ticket(self, message_id: str, sender_email: str, subject: str, body_text: str, source: str) -> str:
        """Inserta el ticket en SQLite evitando duplicados mediante message_id"""
        conn = get_db()
        cur = conn.cursor()

        # Verificar si ya existe el Message-ID
        cur.execute("SELECT ticket_code FROM email_tickets WHERE message_id = ?", (message_id,))
        exists = cur.fetchone()
        if exists:
            conn.close()
            return None

        # Ejecutar TelcoEmailParser sobre el contenido
        full_content = f"{subject}\n{body_text}"
        p = TelcoEmailParser.parse(full_content)

        # Buscar ID de tarea
        cur.execute("SELECT id FROM task_types WHERE code = ?", (p["suggested_task_code"],))
        row_t = cur.fetchone()
        task_type_id = row_t[0] if row_t else 1

        code = f"INC-{random.randint(60000, 99999)}"
        cur.execute("""
        INSERT INTO email_tickets (
            ticket_code, sender_email, subject, full_body, area,
            subscriber_code, serial_pon, node_name, slot_pon, mac_address,
            suggested_task_type_id, status, message_id, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?)
        """, (
            code, sender_email, subject, body_text, p["detected_area"],
            p["subscriber_code"] or "N/A", p["serial_pon"] or "N/A", p["node_name"] or "N/A",
            p["slot_pon"] or "N/A", p["mac_address"] or "N/A", task_type_id, message_id, source
        ))
        conn.commit()
        conn.close()
        return code

    def _decode_header_str(self, header_value: str) -> str:
        if not header_value:
            return ""
        decoded_fragments = decode_header(header_value)
        result = []
        for text, encoding in decoded_fragments:
            if isinstance(text, bytes):
                enc = encoding or "utf-8"
                try:
                    result.append(text.decode(enc, errors="replace"))
                except Exception:
                    result.append(text.decode("latin-1", errors="replace"))
            else:
                result.append(str(text))
        return "".join(result)

    def _extract_body(self, msg) -> str:
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition"))
                if content_type == "text/plain" and "attachment" not in content_disposition:
                    charset = part.get_content_charset() or "utf-8"
                    payload = part.get_payload(decode=True)
                    if payload:
                        return payload.decode(charset, errors="replace")
            # Fallback a text/html si no hay text/plain
            for part in msg.walk():
                if part.get_content_type() == "text/html":
                    charset = part.get_content_charset() or "utf-8"
                    payload = part.get_payload(decode=True)
                    if payload:
                        raw_html = payload.decode(charset, errors="replace")
                        # Limpieza básica de etiquetas HTML
                        import re
                        return re.sub(r'<[^>]+>', ' ', raw_html)
        else:
            charset = msg.get_content_charset() or "utf-8"
            payload = msg.get_payload(decode=True)
            if payload:
                return payload.decode(charset, errors="replace")
        return ""

# Instancia global del worker
mail_worker_instance = MailWorker()
