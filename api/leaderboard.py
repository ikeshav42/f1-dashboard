from http.server import BaseHTTPRequestHandler
import json, asyncio, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _openf1 import fetch_leaderboard


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        data = asyncio.run(fetch_leaderboard())
        self._send(data, ttl=30)

    def _send(self, data, ttl=15):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", f"s-maxage={ttl}, stale-while-revalidate={ttl * 2}, stale-if-error=600")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass
