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
    from services.audit import log_audit_event
except ImportError:
    from app.database import get_db
    from app.services.email_parser import TelcoEmailParser
    from app.services.audit import log_audit_event

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
            "total_processed": self.emails_processed,
            "last_error": self.last_error,
            "imap_server": self.config.get("imap_server", ""),
            "imap_user": self.config.get("imap_user", ""),
            "has_password": bool(self.config.get("imap_password", "")),
            "config": self.config
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

    def _sync_simulator(self, area: str = None) -> dict:
        """Modo simulador de laboratorio: genera un caso telco estructurado"""
        sample_cases = [
            {
                "sender": "cuadrilla.chacao@inter.com.ve",
                "subject": "Falla ONT Discovery permanente - Nodo Chacao",
                "body": f"Buenas tardes soporte, favor apoyo con AB {random.choice(['10', '25', '30'])}{random.randint(10000000, 99999999)} con serial FHTT{random.randint(10000000, 99999999)} en OLT-CHAC-01. La ONT emite -19.4 dBm pero no sube a Whitelist. Demonio atascado.",
                "area": "Soporte"
            },
            {
                "sender": "cuadrilla.centro@inter.com.ve",
                "subject": "Cliente IP Certificada sin tráfico / Modo Bridge",
                "body": f"Cliente corporativo con AB {random.choice(['10', '25', '30'])}{random.randint(10000000, 99999999)} serial HWTC{random.randint(10000000, 99999999)} en OLT-CCS-02. Modo bridge con IP certificada, validar WANMAC 00:1a:2b:{random.randint(10,99)}:{random.randint(10,99)}:{random.randint(10,99)} en 815.",
                "area": "Soporte"
            },
            {
                "sender": "monitoreo.core@inter.com.ve",
                "subject": "Alerta de saturación enlace troncal OLT",
                "body": "Alerta automática NOC: Enlace troncal OLT-CCS-01 slot uplink 1 saturado al 79.4% (7.9 Gbps). Planificar ampliación PortChannel 20G.",
                "area": "Cabecera"
            },
            {
                "sender": "soporte.voip@inter.com.ve",
                "subject": "Falla registro SIP en ONT residencial",
                "body": f"AB {random.choice(['10', '25', '30'])}{random.randint(10000000, 99999999)} con serial FHTT{random.randint(10000000, 99999999)} en OLT-VAL-02 reporta SIP 403 Forbidden. Revisar dialplan.",
                "area": "Telefonía"
            }
        ]
        
        candidates = sample_cases
        if area and area not in ["Todas", "General", ""]:
            filtered = [c for c in sample_cases if c.get("area", "").lower() == area.lower()]
            if filtered:
                candidates = filtered
                
        selected = random.choice(candidates)
        target_area = selected.get("area", "Soporte")
        msg_id = f"<sim-{int(time.time())}-{random.randint(1000,9999)}@inter.com.ve>"
        sim_code = f"INC-{random.randint(60000, 99999)}"

        # Crear membrete corporativo HTML de prueba
        base_static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "attachments", sim_code)
        os.makedirs(base_static_dir, exist_ok=True)
        
        # Generar imagen de evidencia SVG/PNG simulada en terreno
        img_name = "reporte_terreno_ont.png"
        img_disk_path = os.path.join(base_static_dir, img_name)
        img_web_path = f"/static/attachments/{sim_code}/{img_name}"
        
        # Guardar archivo PNG simulado transparente con datos
        try:
            # 1x1 dummy PNG bytes con header PNG valido
            png_header = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82'
            with open(img_disk_path, "wb") as f_dummy:
                f_dummy.write(png_header)
        except Exception:
            pass

        sim_html = f"""
        <div style="font-family: Arial, sans-serif; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; max-width: 620px; background: #FFFFFF;">
            <div style="background: #0056B3; color: #FFFFFF; padding: 14px 20px; border-bottom: 2px solid #004494;">
                <h2 style="margin: 0; font-size: 15px; font-weight: bold; letter-spacing: 0.5px;">INTER &bull; INGENIERÍA Y OPERACIONES IP</h2>
                <p style="margin: 3px 0 0 0; font-size: 11px; opacity: 0.9;">Reporte Oficial de Cuadrilla Técnica en Terreno</p>
            </div>
            <div style="padding: 18px 20px; font-size: 13px; color: #1E293B; line-height: 1.6;">
                <p style="margin-top: 0;">{selected['body']}</p>
                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px; margin-top: 14px;">
                    <p style="margin: 0 0 6px 0; font-weight: bold; color: #0056B3; font-size: 11px;">PARÁMETROS CAPTURADOS EN CAJA NAP:</p>
                    <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                        <tr><td style="color: #64748B; padding: 2px 0;">Potencia Óptica RX:</td><td><strong style="color: #059669;">-19.4 dBm (En Rango)</strong></td></tr>
                        <tr><td style="color: #64748B; padding: 2px 0;">Estado Demonio OLT:</td><td><strong style="color: #DC2626;">Discovery Permanente</strong></td></tr>
                        <tr><td style="color: #64748B; padding: 2px 0;">Evidencia Adjunta:</td><td><span style="font-family: monospace; font-size: 11px; color: #0056B3;">{img_name}</span></td></tr>
                    </table>
                </div>
            </div>
            <div style="background: #F1F5F9; padding: 10px 20px; font-size: 10px; color: #64748B; border-top: 1px solid #E2E8F0;">
                Documento transmitido automáticamente desde Terminal Móvil de Terreno FSM &bull; Red FibraHogar Inter
            </div>
        </div>
        """

        sim_attachments = [
            {
                "filename": img_name,
                "content_type": "image/png",
                "file_path": img_web_path,
                "content_id": "reporte_terreno_cid",
                "is_inline": 1,
                "file_size": 85000
            }
        ]
        
        inserted_code = self._insert_ticket(
            message_id=msg_id,
            sender_email=selected["sender"],
            subject=selected["subject"],
            body_text=selected["body"],
            source="SIMULADOR",
            html_body=sim_html,
            attachments=sim_attachments,
            forced_code=sim_code
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

            # RFC 3501: El criterio estándar para mensajes no leídos es UNSEEN
            status, messages = mail.search(None, "UNSEEN")
            if status != "OK" or not messages or not messages[0]:
                mail.close()
                mail.logout()
                return {"status": "ok", "mode": "REAL_IMAP", "new_count": 0, "message": "No hay correos no leídos en el buzón."}

            msg_ids = messages[0].split()
            # Limitar a los 20 más recientes para evitar sobrecargas en pruebas iniciales
            msg_ids = msg_ids[-20:]
            for msg_id_bytes in msg_ids:
                res_fetch, msg_data = mail.fetch(msg_id_bytes, "(RFC822)")
                if res_fetch != "OK":
                    continue

                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                # 1. Message-ID para deduplicación
                message_id = msg.get("Message-ID") or f"<no-id-{int(time.time())}-{msg_id_bytes.decode()}@imap>"
                
                # 2. Decodificar Asunto, Remitente y Destinatario
                subject = self._decode_header_str(msg.get("Subject", "Sin Asunto"))
                sender = self._decode_header_str(msg.get("From", "remitente@desconocido.com"))
                recipient = self._decode_header_str(msg.get("To", user or ""))

                # 3. Extraer Cuerpo, HTML con CIDs y Adjuntos/Membretes
                temp_code = f"INC-{random.randint(60000, 99999)}"
                body, html_b, atts = self._extract_content_and_attachments(msg, temp_code)

                # 4. Ingestar y marcar como leído
                t_code = self._insert_ticket(
                    message_id=message_id,
                    sender_email=sender,
                    subject=subject,
                    body_text=body,
                    source="REAL_IMAP",
                    recipient_email=recipient,
                    html_body=html_b,
                    attachments=atts,
                    forced_code=temp_code
                )
                if t_code:
                    new_tickets.append(t_code)
                    self.emails_processed += 1
                    # Marcar como visto en el servidor IMAP
                    mail.store(msg_id_bytes, "+FLAGS", "\\Seen")
                    log_audit_event(
                        action="INGESTA_CORREO",
                        entity_type="TICKET",
                        entity_id=t_code,
                        details=f"Correo IMAP '{subject[:45]}' de {sender} hacia {recipient}",
                        ip_address="IMAP_WORKER"
                    )

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

    def test_connection(self, server: str, port: int, user: str, password: str, mailbox: str = "INBOX") -> dict:
        """
        Prueba la conectividad SSL/TLS con el servidor IMAP (Outlook, Exchange, etc.)
        y genera un reporte de diagnóstico con latencia y carpetas disponibles.
        """
        import ssl
        start_time = time.time()
        
        if not server or not user or not password:
            return {
                "status": "error",
                "stage": "VALIDACION",
                "message": "Faltan parámetros de conexión: host, usuario o password requeridos."
            }
            
        mail = None
        current_stage = "CONEXION"
        try:
            current_stage = "CONEXION"
            ssl_context = ssl.create_default_context()
            mail = imaplib.IMAP4_SSL(host=server, port=int(port), ssl_context=ssl_context)
            ssl_version = mail.sock.version() if hasattr(mail, "sock") and mail.sock else "TLS"
            
            current_stage = "AUTENTICACION"
            mail.login(user, password)
            
            current_stage = "BUZON"
            sel_status, sel_data = mail.select(mailbox, readonly=True)
            unread_count = 0
            if sel_status == "OK":
                try:
                    # RFC 3501: Criterio estándar UNSEEN para correos no leídos (no UNREAD)
                    s_status, messages = mail.search(None, "UNSEEN")
                    if s_status == "OK" and messages and messages[0]:
                        unread_count = len(messages[0].split())
                except Exception as s_err:
                    logger.warning(f"Aviso consultando mensajes UNSEEN: {s_err}")
            
            list_status, list_data = mail.list()
            folder_names = []
            if list_status == "OK" and list_data:
                for f in list_data:
                    if isinstance(f, bytes):
                        f_str = f.decode("utf-8", errors="replace")
                        parts = f_str.split(' "/" ')
                        if len(parts) > 1:
                            folder_names.append(parts[-1].replace('"', '').strip())
                        else:
                            folder_names.append(f_str.strip())
            
            elapsed_ms = round((time.time() - start_time) * 1000)
            try:
                mail.close()
                mail.logout()
            except Exception:
                pass
            
            return {
                "status": "ok",
                "stage": "EXITO",
                "server": server,
                "port": port,
                "user": user,
                "mailbox": mailbox,
                "ssl_version": ssl_version,
                "latency_ms": elapsed_ms,
                "unread_count": unread_count,
                "folders_detected": folder_names[:8],
                "message": f"Conexión SSL/TLS exitosa con {server}. Latencia: {elapsed_ms} ms. Correos no leídos: {unread_count}."
            }
        except imaplib.IMAP4.error as e:
            elapsed_ms = round((time.time() - start_time) * 1000)
            err_msg = str(e)
            advice = "Verifique sus credenciales."
            if "BASIC AUTHENTICATION IS DISABLED" in err_msg.upper():
                advice = "Microsoft ha deshabilitado la autenticación básica para esta cuenta. Debe generar una 'Contraseña de Aplicación' en su cuenta de Microsoft (myaccount.microsoft.com) o usar un buzón corporativo con IMAP habilitado."
            elif "AUTHENTICATIONFAILED" in err_msg.upper():
                advice = "Fallo de autenticación. Si la cuenta usa doble factor (2FA/MFA), debe generar una 'Contraseña de Aplicación' en su cuenta Microsoft/Google."
            elif current_stage == "BUZON":
                advice = f"No se pudo acceder a la carpeta '{mailbox}'. Verifique que exista o use 'INBOX'."
            return {
                "status": "error",
                "stage": current_stage,
                "latency_ms": elapsed_ms,
                "message": f"Error IMAP ({current_stage}): {err_msg}",
                "advice": advice
            }
        except Exception as e:
            elapsed_ms = round((time.time() - start_time) * 1000)
            return {
                "status": "error",
                "stage": current_stage,
                "latency_ms": elapsed_ms,
                "message": f"Error de conexión ({current_stage}) al servidor {server}:{port}: {str(e)}",
                "advice": "Verifique el nombre de host del servidor IMAP y que el puerto 993 no esté bloqueado por firewall."
            }

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

    def _extract_content_and_attachments(self, msg, ticket_code: str) -> tuple:
        """
        Analiza el correo MIME multipart/related y multipart/mixed:
        1. Extrae el texto plano.
        2. Extrae el cuerpo HTML.
        3. Identifica membretes e imagenes inline referenciadas con cid:
        4. Identifica y almacena archivos adjuntos regulares.
        5. Reemplaza las referencias 'cid:xxx' por la URL web local '/static/attachments/...'.
        Retorna (plain_text, html_body, attachments_list)
        """
        plain_text = ""
        html_body = ""
        attachments = []

        base_static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "attachments", ticket_code)
        os.makedirs(base_static_dir, exist_ok=True)

        img_counter = 1

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition") or "")
                content_id = str(part.get("Content-ID") or "").strip("<>")

                # Texto Plano
                if content_type == "text/plain" and "attachment" not in content_disposition:
                    charset = part.get_content_charset() or "utf-8"
                    payload = part.get_payload(decode=True)
                    if payload and not plain_text:
                        plain_text = payload.decode(charset, errors="replace")

                # Cuerpo HTML
                elif content_type == "text/html" and "attachment" not in content_disposition:
                    charset = part.get_content_charset() or "utf-8"
                    payload = part.get_payload(decode=True)
                    if payload and not html_body:
                        html_body = payload.decode(charset, errors="replace")

                # Imagenes o Adjuntos
                elif content_type.startswith("image/") or "attachment" in content_disposition or content_id:
                    payload = part.get_payload(decode=True)
                    if not payload:
                        continue

                    # Obtener nombre de archivo limpio
                    raw_filename = part.get_filename()
                    if raw_filename:
                        filename = self._decode_header_str(raw_filename)
                    else:
                        ext = content_type.split("/")[-1] if "/" in content_type else "png"
                        filename = f"membrete_img_{img_counter}.{ext}"
                        img_counter += 1

                    # Sanitizar nombre
                    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
                    file_disk_path = os.path.join(base_static_dir, filename)
                    file_web_path = f"/static/attachments/{ticket_code}/{filename}"

                    try:
                        with open(file_disk_path, "wb") as f_img:
                            f_img.write(payload)
                    except Exception as e_w:
                        logger.warning(f"Error escribiendo adjunto {filename}: {e_w}")

                    is_inline = bool(content_id or "inline" in content_disposition.lower() or content_type.startswith("image/"))
                    
                    attachments.append({
                        "filename": filename,
                        "content_type": content_type,
                        "file_path": file_web_path,
                        "content_id": content_id,
                        "is_inline": 1 if is_inline else 0,
                        "file_size": len(payload)
                    })

                    # Mapear Content-ID (CID) a la ruta web estatica local
                    if content_id and html_body:
                        html_body = html_body.replace(f"cid:{content_id}", file_web_path)
                        html_body = html_body.replace(f"cid:<{content_id}>", file_web_path)

        else:
            charset = msg.get_content_charset() or "utf-8"
            payload = msg.get_payload(decode=True)
            if payload:
                text_dec = payload.decode(charset, errors="replace")
                if msg.get_content_type() == "text/html":
                    html_body = text_dec
                    plain_text = re.sub(r'<[^>]+>', ' ', text_dec)
                else:
                    plain_text = text_dec

        # Si habian CIDs en attachments que se extrajeron despues del HTML, volver a sustituirlos
        if html_body:
            for att in attachments:
                if att["content_id"]:
                    html_body = html_body.replace(f"cid:{att['content_id']}", att["file_path"])
                    html_body = html_body.replace(f"cid:<{att['content_id']}>", att["file_path"])

        # Fallback de texto si faltaba
        if not plain_text and html_body:
            plain_text = re.sub(r'<[^>]+>', ' ', html_body)
        plain_text = re.sub(r'\s+', ' ', plain_text).strip()

        return plain_text, html_body, attachments

    def _extract_body(self, msg) -> str:
        text, _, _ = self._extract_content_and_attachments(msg, "TEMP")
        return text

    def _insert_ticket(
        self, 
        message_id: str, 
        sender_email: str, 
        subject: str, 
        body_text: str, 
        source: str, 
        recipient_email: str = "",
        html_body: str = None,
        attachments: list = None,
        forced_code: str = None
    ) -> str:
        """Inserta el ticket en SQLite con html_body y registro de imagenes/adjuntos"""
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

        code = forced_code or f"INC-{random.randint(60000, 99999)}"
        cur.execute("""
        INSERT INTO email_tickets (
            ticket_code, sender_email, subject, full_body, html_body, area,
            subscriber_code, serial_pon, node_name, slot_pon, mac_address,
            suggested_task_type_id, status, message_id, source, recipient_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?, ?)
        """, (
            code, sender_email, subject, body_text, html_body or "", p["detected_area"],
            p["subscriber_code"] or "N/A", p["serial_pon"] or "N/A", p["node_name"] or "N/A",
            p["slot_pon"] or "N/A", p["mac_address"] or "N/A", task_type_id, message_id, source, recipient_email or ""
        ))
        ticket_id = cur.lastrowid

        # Insertar adjuntos y membretes si existen
        if attachments:
            for att in attachments:
                cur.execute("""
                INSERT INTO ticket_attachments (
                    ticket_id, filename, content_type, file_path, content_id, is_inline, file_size
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    ticket_id, att["filename"], att["content_type"], att["file_path"],
                    att.get("content_id") or "", att.get("is_inline", 0), att.get("file_size", 0)
                ))

        conn.commit()
        conn.close()
        return code

# Instancia global del worker
mail_worker_instance = MailWorker()
