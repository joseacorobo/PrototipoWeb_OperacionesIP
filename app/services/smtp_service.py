import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from datetime import datetime
import logging

try:
    from database import get_db
    from services.audit import log_audit_event
except ImportError:
    from app.database import get_db
    from app.services.audit import log_audit_event

logger = logging.getLogger("smtp_service")

class SMTPService:
    """
    Servicio de despacho de correos electronicos salientes via SMTP.
    Garantiza el estandar RFC 5322 para agrupar respuestas en el mismo
    hilo de conversacion (In-Reply-To y References) tanto en Outlook como en Gmail.
    """

    def __init__(self):
        pass

    def _get_worker_credentials(self):
        """Obtiene las credenciales configuradas en el worker de correo"""
        try:
            from services.mail_worker import mail_worker_instance
        except ImportError:
            from app.services.mail_worker import mail_worker_instance
        
        cfg = mail_worker_instance.config or {}
        mode = cfg.get("mode", "SIMULATOR")
        imap_server = cfg.get("imap_server", "")
        imap_user = cfg.get("imap_user", "")
        imap_password = cfg.get("imap_password", "")

        # Inferir host SMTP segun el host IMAP
        smtp_server = cfg.get("smtp_server")
        if not smtp_server:
            if "gmail" in imap_server.lower():
                smtp_server = "smtp.gmail.com"
            elif "office365" in imap_server.lower() or "outlook" in imap_server.lower():
                smtp_server = "smtp.office365.com"
            else:
                smtp_server = imap_server.replace("imap.", "smtp.") if "imap." in imap_server else "smtp.gmail.com"

        smtp_port = int(cfg.get("smtp_port", 587))
        return {
            "mode": mode,
            "server": smtp_server,
            "port": smtp_port,
            "user": imap_user,
            "password": imap_password
        }

    def send_reply(
        self,
        ticket_id: int,
        user_id: int,
        body_text: str,
        user_name: str = "Jose Corobo",
        user_role: str = "ESPECIALISTA",
        user_area: str = "Soporte",
        custom_recipient: str = None,
        custom_subject: str = None,
        ip_address: str = "127.0.0.1"
    ) -> dict:
        """
        Envia una respuesta formal por correo y la registra en base de datos y auditoria.
        """
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
        SELECT ticket_code, sender_email, recipient_email, subject, message_id, area, status
        FROM email_tickets WHERE id = ?
        """, (ticket_id,))
        ticket = cur.fetchone()
        if not ticket:
            conn.close()
            return {"status": "error", "message": "Ticket no encontrado"}

        ticket_code = ticket["ticket_code"]
        recipient = custom_recipient or ticket["sender_email"] or "soporte@inter.com.ve"
        orig_subject = ticket["subject"] or "Ticket de Operaciones IP"
        orig_message_id = ticket["message_id"] or f"<{ticket_code}@inter.com.ve>"

        # Formar asunto Re:
        if orig_subject.lower().startswith("re:"):
            subject = orig_subject
        else:
            subject = f"Re: {orig_subject}"
        if custom_subject:
            subject = custom_subject

        # Obtener credenciales SMTP
        creds = self._get_worker_credentials()
        from_email = creds["user"] or "operaciones@inter.com.ve"

        # Construir cuerpo HTML corporativo con membrete de respuesta
        clean_text_paragraphs = "".join([f"<p style='margin: 0 0 12px 0; line-height: 1.5;'>{line}</p>" for line in body_text.splitlines() if line.strip()])
        
        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; color: #1E293B; background-color: #F8FAFC; margin: 0; padding: 20px; }}
                .card {{ max-width: 650px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }}
                .header {{ background: #0056B3; color: #FFFFFF; padding: 18px 24px; }}
                .header h1 {{ margin: 0; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }}
                .header p {{ margin: 4px 0 0 0; font-size: 12px; opacity: 0.85; }}
                .body {{ padding: 24px; font-size: 13px; color: #334155; }}
                .badge {{ display: inline-block; padding: 3px 8px; background: #EFF6FF; color: #0056B3; font-weight: bold; border-radius: 4px; font-size: 11px; border: 1px solid #BFDBFE; }}
                .signature {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #64748B; }}
                .footer {{ background: #F1F5F9; padding: 12px 24px; text-align: center; font-size: 10px; color: #94A3B8; border-top: 1px solid #E2E8F0; }}
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <h1>INTER - OPERACIONES IP Y TELECOMUNICACIONES</h1>
                    <p>Respuesta Oficial - Centro de Gestion de Red NOC / FTTH</p>
                </div>
                <div class="body">
                    <div style="margin-bottom: 16px;">
                        <span class="badge">TICKET: {ticket_code}</span>
                        <span style="font-size: 11px; color: #64748B; margin-left: 8px;">Celula: {ticket['area']}</span>
                    </div>

                    <div style="font-size: 13px; color: #0F172A;">
                        {clean_text_paragraphs}
                    </div>

                    <div class="signature">
                        <p style="margin: 0; font-weight: bold; color: #0F172A; font-size: 12px;">{user_name}</p>
                        <p style="margin: 2px 0 0 0;">{user_role} - Celula de {user_area}</p>
                        <p style="margin: 2px 0 0 0; color: #0056B3;">Direccion de Ingenieria y Operaciones IP - Corporacion Inter</p>
                    </div>
                </div>
                <div class="footer">
                    Este mensaje es una notificacion tecnica automatica generada desde la Plataforma FSM de Operaciones IP de Inter.
                </div>
            </div>
        </body>
        </html>
        """

        msg_id = make_msgid(domain="inter.com.ve")
        smtp_success = False
        smtp_message = ""

        # Si tenemos credenciales reales y servidor configurado, intentar envio SMTP
        if creds["user"] and creds["password"] and creds["server"] and creds["mode"] != "SIMULATOR":
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = f"{user_name} <{from_email}>"
                msg["To"] = recipient
                msg["Date"] = formatdate(localtime=True)
                msg["Message-ID"] = msg_id
                
                # Cabeceras de hilo de conversacion RFC 5322
                if orig_message_id:
                    clean_msg_id = orig_message_id if orig_message_id.startswith("<") else f"<{orig_message_id}>"
                    msg["In-Reply-To"] = clean_msg_id
                    msg["References"] = clean_msg_id

                part_plain = MIMEText(body_text, "plain", "utf-8")
                part_html = MIMEText(body_html, "html", "utf-8")
                msg.attach(part_plain)
                msg.attach(part_html)

                if creds["port"] == 465:
                    context = ssl.create_default_context()
                    with smtplib.SMTP_SSL(creds["server"], creds["port"], context=context, timeout=15) as server:
                        server.login(creds["user"], creds["password"])
                        server.send_message(msg)
                else:
                    with smtplib.SMTP(creds["server"], creds["port"], timeout=15) as server:
                        server.ehlo()
                        context = ssl.create_default_context()
                        server.starttls(context=context)
                        server.ehlo()
                        server.login(creds["user"], creds["password"])
                        server.send_message(msg)

                smtp_success = True
                smtp_message = f"Correo despachado exitosamente via SMTP ({creds['server']}:{creds['port']}) a {recipient}."
            except Exception as e:
                logger.error(f"Error despachando correo SMTP: {e}")
                smtp_success = False
                smtp_message = f"Fallo al contactar servidor SMTP ({str(e)}). El mensaje quedo registrado localmente."
        else:
            # Modo simulado de laboratorio
            smtp_success = True
            smtp_message = f"Respuesta registrada en modo laboratorio. Destinatario: {recipient} (In-Reply-To: {orig_message_id})."

        # Registrar en la tabla email_replies
        status_label = "ENVIADO" if smtp_success else "ERROR"
        cur.execute("""
        INSERT INTO email_replies (
            ticket_id, user_id, recipient_email, subject, body_html, body_text, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (ticket_id, user_id, recipient, subject, body_html, body_text, status_label))
        
        reply_id = cur.lastrowid
        conn.commit()
        conn.close()

        # Registrar en bitacora forense de auditoria
        log_audit_event(
            user_id=user_id,
            user_name=user_name,
            user_role=user_role,
            area=user_area,
            action="ENVIO_CORREO_RESPUESTA",
            entity_type="TICKET",
            entity_id=ticket_code,
            details=f"Respuesta enviada a {recipient} ({status_label}): {body_text[:60]}...",
            ip_address=ip_address
        )

        return {
            "status": "ok" if smtp_success else "partial",
            "reply_id": reply_id,
            "ticket_code": ticket_code,
            "recipient": recipient,
            "subject": subject,
            "message": smtp_message,
            "smtp_sent": smtp_success
        }

smtp_service_instance = SMTPService()
