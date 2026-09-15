import sys
import os

try:
    from database import get_db
except ImportError:
    from app.database import get_db

def log_audit_event(
    user_id: int = None,
    user_name: str = None,
    user_role: str = None,
    area: str = None,
    action: str = "ACCION",
    entity_type: str = "SISTEMA",
    entity_id: str = None,
    details: str = "",
    ip_address: str = "127.0.0.1"
):
    """
    Registra de manera atomica una entrada en la bitacora forense audit_logs.
    Garantiza trazabilidad de usuario, rol, celula, accion y entidad intervenida.
    """
    try:
        conn = get_db()
        cur = conn.cursor()
        
        # Si se proporciona user_id y faltan datos de perfil, resolver desde la base de datos
        if user_id and (not user_name or not user_role or not area):
            cur.execute("SELECT name, role, area FROM users WHERE id = ?", (user_id,))
            u = cur.fetchone()
            if u:
                user_name = user_name or u[0]
                user_role = user_role or u[1]
                area = area or u[2]
                
        user_name = user_name or "Sistema / Automatico"
        user_role = user_role or "SISTEMA"
        area = area or "Operaciones IP"
        
        cur.execute("""
        INSERT INTO audit_logs (
            user_id, user_name, user_role, user_area, area, action, target_type, entity_type, target_id, entity_id, details, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id, user_name, user_role, area, area, action, entity_type, entity_type, str(entity_id or ""), str(entity_id or ""), details, ip_address
        ))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[AUDIT_ERROR] Error registrando auditoria: {e}")
        return False

def get_audit_logs(limit: int = 50, user_id: int = None, action: str = None, area: str = None):
    """Consulta la bitacora de auditoria con filtros opcionales ordenados cronologicamente descendente"""
    try:
        conn = get_db()
        cur = conn.cursor()
        
        query = "SELECT id, user_id, user_name, user_role, COALESCE(area, user_area) as area, action, COALESCE(entity_type, target_type) as entity_type, COALESCE(entity_id, target_id) as entity_id, details, ip_address, created_at FROM audit_logs WHERE 1=1"
        params = []
        
        if user_id:
            query += " AND user_id = ?"
            params.append(user_id)
        if action and action != "TODAS":
            query += " AND action = ?"
            params.append(action)
        if area and area not in ["Todas", "Todas las Areas", "Todas las Celulas"]:
            query += " AND (area = ? OR user_area = ?)"
            params.extend([area, area])
            
        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)
        
        cur.execute(query, params)
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        print(f"[AUDIT_ERROR] Error consultando auditoria: {e}")
        return []
