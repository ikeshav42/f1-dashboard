from http.server import BaseHTTPRequestHandler
import json, asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from _openf1 import fetch_session


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        data = asyncio.run(fetch_session())
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "s-maxage=60, stale-while-revalidate=120")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass
