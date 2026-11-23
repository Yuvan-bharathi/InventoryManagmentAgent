import urllib.request

try:
    req = urllib.request.Request("http://127.0.0.1:8000/api/intelligence/procurement/overview")
    with urllib.request.urlopen(req) as resp:
        body = resp.read()
        print("Status:", resp.status)
        print("Body len:", len(body))
        print("Body preview:", body[:500])
except Exception as e:
    print("Error:", e)

