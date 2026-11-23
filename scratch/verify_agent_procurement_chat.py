import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.auth import issue_token, Principal
import urllib.request
import json

p = Principal(1, "leader", "Leela Iyer", "ORG-01", "leadership", ["IN-TN-01", "IN-KA-01"])
token = issue_token(p)
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

url = "http://127.0.0.1:8000/api/agent/chat"
body = {
    "question": "Which supplier offers the best overall purchasing decision for MAT-CAM-007 camera modules?",
    "context": {}
}

req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        print("Status:", resp.status)
        data = json.loads(resp.read().decode())
        print("Agent Reply Preview:")
        print(data.get("reply", data.get("text", data.get("message", "")))[:1000])
        print("Tools used:", data.get("tools_used", data.get("steps", [])))
except Exception as e:
    print("Error:", e)
