"""Automated smoke tests for Inbox → Agent → Orchestrator telemetry.

Usage:
  DRACO_BASE_URL=https://staging.drako.systems \
  DRACO_TENANT_ID=tenant_123 \
  DRACO_AUTH_COOKIE=session=... \
  python scripts/test_orchestrator_flow.py

Optional env vars for SaaS playbook test:
  DRACO_SAAS_ID, DRACO_SAAS_SLUG, DRACO_SAAS_NAME
"""
import json
import os
import sys
import time
import uuid
from typing import Any, Dict, Optional, Tuple

import requests

BASE_URL = os.environ.get("DRACO_BASE_URL", "http://localhost:3000")
TENANT_ID = os.environ.get("DRACO_TENANT_ID")
AUTH_COOKIE = os.environ.get("DRACO_AUTH_COOKIE")
SAAS_ID = os.environ.get("DRACO_SAAS_ID")
SAAS_SLUG = os.environ.get("DRACO_SAAS_SLUG")
SAAS_NAME = os.environ.get("DRACO_SAAS_NAME", SAAS_SLUG)
VERIFY_TLS = os.environ.get("DRACO_SKIP_TLS_VERIFY") is None

if not TENANT_ID:
    sys.exit("❌ Missing DRACO_TENANT_ID env var")

HEADERS = {
    "x-tenant-id": TENANT_ID,
    "content-type": "application/json",
}
COOKIES: Dict[str, str] = {}
if AUTH_COOKIE:
    if "=" not in AUTH_COOKIE:
        sys.exit("❌ DRACO_AUTH_COOKIE must be in 'name=value' format")
    name, value = AUTH_COOKIE.split("=", 1)
    COOKIES[name.strip()] = value.strip()

def api_request(method: str, path: str, json_body: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None):
    url = BASE_URL.rstrip("/") + path
    resp = requests.request(
        method,
        url,
        headers=HEADERS,
        cookies=COOKIES,
        json=json_body,
        params=params,
        timeout=30,
        verify=VERIFY_TLS,
    )
    try:
        data = resp.json()
    except json.JSONDecodeError:
        data = resp.text
    if resp.status_code >= 400:
        raise RuntimeError(f"{method} {path} failed ({resp.status_code}): {data}")
    return data

def create_inbox_message() -> Dict[str, Any]:
    test_id = str(uuid.uuid4())
    payload = {
        "channel": "email",
        "direction": "inbound",
        "from_address": "qa@drako.systems",
        "to_address": "ops@drako.systems",
        "subject": f"QA inbox test {test_id}",
        "full_body": "Esto es un mensaje de QA para verificar métricas",
        "status": "error",  # fuerza alerta warning
    }
    data = api_request("POST", "/api/inbox", payload)
    payload["id"] = data.get("id")
    return payload

def post_orchestrator_inbox(message: Dict[str, Any]):
    thread_id = f"thread_inbox_{uuid.uuid4()}"
    context = {
        "scope": "inbox",
        "path": "/inbox",
        "inbox": {
            "id": message["id"],
            "channel": message["channel"],
            "status": message.get("status", "nuevo"),
            "department_id": message.get("department_id"),
            "subject": message.get("subject"),
            "preview": message.get("full_body", "")[:120],
            "saas_id": message.get("saas_id"),
        },
    }
    body = {
        "thread_id": thread_id,
        "message": "Resume y ejecuta los siguientes pasos para resolver este inbox",
        "context": context,
    }
    return api_request("POST", "/api/orchestrator", body), thread_id

def post_orchestrator_playbook() -> Optional[Tuple[Dict[str, Any], str]]:
    if not (SAAS_ID and SAAS_SLUG):
        print("⚠️  DRACO_SAAS_ID/SLUG not provided, skipping playbook test")
        return None
    thread_id = f"thread_saas_{uuid.uuid4()}"
    context = {
        "scope": "saas",
        "path": f"/saas/{SAAS_SLUG}",
        "saas": {
            "id": SAAS_ID,
            "name": SAAS_NAME or SAAS_SLUG,
            "slug": SAAS_SLUG,
            "domain": None,
            "status": "active",
            "social_accounts": [],
        },
    }
    body = {
        "thread_id": thread_id,
        "message": f"Por favor ejecuta el playbook de provisión para {SAAS_SLUG}",
        "context": context,
        "saasSlug": SAAS_SLUG,
    }
    return api_request("POST", "/api/orchestrator", body), thread_id

def fetch_recent_metrics(limit=5):
    return api_request("GET", "/api/metrics", params={"limit": limit})

def fetch_recent_alerts(saas_id: Optional[str] = None):
    params = {"saas_id": saas_id} if saas_id else {}
    return api_request("GET", "/api/alerts", params=params)

def summarize_metrics(response: Dict[str, Any], scope_filter: Optional[str] = None):
    items = response.get("items", [])
    if scope_filter:
        items = [i for i in items if i.get("scope") == scope_filter]
    if not items:
        print(f"⚠️  No metrics found for scope={scope_filter}")
    else:
        latest = items[0]
        print("✅ Última métrica registrada:")
        print(json.dumps(latest, indent=2, ensure_ascii=False))

def summarize_alerts(response: Dict[str, Any], keyword: str):
    items = response.get("items", [])
    match = next((a for a in items if keyword in a.get("message", "")), None)
    if match:
        print("✅ Alerta encontrada:")
        print(json.dumps(match, indent=2, ensure_ascii=False))
    else:
        print("⚠️  No alert found matching keyword", keyword)


def main():
    print("▶️  Creando mensaje de Inbox de prueba...")
    inbox_msg = create_inbox_message()
    print(f"   ID: {inbox_msg['id']}")

    print("▶️  Ejecutando POST /api/orchestrator (Inbox)...")
    resp, _ = post_orchestrator_inbox(inbox_msg)
    if not resp.get("ok"):
        raise RuntimeError(f"Orchestrator inbox run failed: {resp}")
    print("   Respuesta OK, registrando métricas/alertas...")
    time.sleep(1)  # dar tiempo al commit en D1

    metrics = fetch_recent_metrics()
    summarize_metrics(metrics, scope_filter="inbox")

    alerts = fetch_recent_alerts()
    summarize_alerts(alerts, keyword=f"Inbox {inbox_msg['id']}")

    playbook_result = post_orchestrator_playbook()
    if playbook_result:
        resp2, _ = playbook_result
        if not resp2.get("ok"):
            print("⚠️  Playbook respondió sin ok:", resp2)
        time.sleep(1)
        metrics = fetch_recent_metrics()
        summarize_metrics(metrics, scope_filter="saas")
        alerts = fetch_recent_alerts(SAAS_ID)
        summarize_alerts(alerts, keyword="Playbook ejecutado")

    print("✅ Flujo automatizado completado")


if __name__ == "__main__":
    main()
