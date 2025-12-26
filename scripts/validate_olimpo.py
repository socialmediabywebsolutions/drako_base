import os

ROOT = "src/app/api"
TARGET = "requireTenantAccess"

def scan_api_handlers():
    for root, dirs, files in os.walk(ROOT):
        for file in files:
            if file.endswith((".ts", ".tsx")):
                full_path = os.path.join(root, file)
                with open(full_path, encoding="utf-8") as f:
                    code = f.read()
                    if "resolveTenantId" in code and TARGET not in code:
                        print(f"[ALERTA] {full_path} usa resolveTenantId sin {TARGET}")
                    elif TARGET not in code:
                        print(f"[REVISAR] {full_path} no invoca {TARGET}")

if __name__ == "__main__":
    print(f"Validando seguridad multi-tenant en {ROOT}...")
    scan_api_handlers()
    print("✅ Validación completada.")
