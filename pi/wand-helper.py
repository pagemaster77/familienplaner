#!/usr/bin/env python3
# Kleines Hilfsprogramm fuer das Wandpanel (Raspberry Pi).
# Hoert nur auf 127.0.0.1:8765 und nur auf Befehle von der Familienplaner-Seite.
import http.server, json, subprocess

ORIGIN = "https://familienplaner.pagemaster77.workers.dev"

class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        if self.headers.get("Origin") != ORIGIN:
            self.send_response(403); self.end_headers(); return
        n = int(self.headers.get("Content-Length", "0"))
        try:
            cmd = json.loads(self.rfile.read(n) or b"{}").get("cmd")
        except Exception:
            cmd = None
        self.send_response(200); self._cors(); self.end_headers()
        self.wfile.write(b"ok"); self.wfile.flush()
        if cmd == "exit":
            subprocess.Popen(["pkill", "-f", "chromium"])
        elif cmd == "reboot":
            subprocess.Popen(["systemctl", "reboot"])

    def log_message(self, *a):
        pass

http.server.HTTPServer(("127.0.0.1", 8765), H).serve_forever()
