import os
import re

# PLANTILLAS GENERALES
def cargar_plantillas(archivo="plantillas_diagnostico.txt"):
    if not os.path.exists(archivo):
        with open(archivo, "w") as f:
            f.write("[CONSULTAS_OLT_TELNET]\n")
            f.write("info_detallada_onu = display ont info {slot} {pon} {onu}\n")
            f.write("[CONSULTAS_BNG_SSH]\n")
            f.write("ver_sesion_suscriptor = show subscribers interface gpon 0/{slot}/{pon}:{onu}\n")
    
    plantillas = {}
    cat_actual = "GENERAL"
    with open(archivo, "r") as f:
        for linea in f:
            linea = linea.strip()
            if not linea or linea.startswith("#"): continue
            if linea.startswith(" ") and linea.endswith(" "):
                cat_actual = linea[1:-1]
                plantillas[cat_actual] = {}
            elif "=" in linea:
                k, v = linea.split("=", 1)
                plantillas.setdefault(cat_actual, {})[k.strip()] = v.strip()
    return plantillas

#EXTRAER PLANTILLAS
def extraer_datos_de_texto(texto_bruto):
    """
    Intenta extraer automáticamente slot, pon y onu si el operador 
    pega una traza o ruta completa (ej: gpon 0/1/3:15 o slot 0 pon 2 onu 10)
    """
    datos = {"slot": "0", "pon": "1", "onu": "1"}
    
    # Patrón común en rutas de red (ej: 0/2/3 ó slot 0/2/3)
    match_ruta = re.search(r'0?/([0-9]+)/([0-9]+)[:/]([0-9]+)', texto_bruto)
    if match_ruta:
        datos["slot"] = match_ruta.group(1)
        datos["pon"] = match_ruta.group(2)
        datos["onu"] = match_ruta.group(3)
    else:
        # Si no hay ruta exacta, pedimos los datos básicos por consola
        print("\n[!] No se detectó una ruta automática en el texto. Ingrese manualmente:")
        datos["slot"] = input("Slot: ")
        datos["pon"] = input("PON: ")
        datos["onu"] = input("ONU ID: ")
        
    return datos

def main():
    print("--- SIMULADOR DE BUSQUEDA / SOPORTE IP (OLT & BNG) ---")
    print("Pegue el reporte de notas, traza o serial de la incidencia (o presione Enter para manual):")
    texto_entrada = input(">> ")

    # Extraer variables automáticamente o manual
    params = extraer_datos_de_texto(texto_entrada)
    
    plantillas = cargar_plantillas()

    print(f"\n[+] Ejecutando consultas para: Slot={params['slot']}, PON={params['pon']}, ONU={params['onu']}\n")

    for categoria, comandos in plantillas.items():
        print(f"=== {categoria} ===")
        for nombre, cmd in comandos.items():
            try:
                cmd_final = cmd.format(slot=params["slot"], pon=params["pon"], onu=params["onu"], ip_onu="192.168.1.1")
                print(f"  -> [{nombre}]: {cmd_final}")
            except KeyError as e:
                print(f"  -> [{nombre}]: Error de variable en plantilla ({e})")
        print()

if __name__ == "__main__":
    main()