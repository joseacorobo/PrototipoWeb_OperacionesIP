import os
import sys
import uvicorn

# Asegurar que app/ esté en sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE_DIR, "app")
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.database import init_db

if __name__ == "__main__":
    # Inicializar esquema y auto-seed si es un servidor nuevo
    print("Iniciando verificación de base de datos...")
    init_db()
    
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
    
    reload = os.environ.get("RELOAD", "true").lower() == "true"
    
    print(f"Servidor Web Operaciones IP iniciado en http://{host}:{port} (reload={reload})")
    if reload:
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            reload=True,
            access_log=True
        )
    else:
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            workers=workers,
            access_log=True
        )
