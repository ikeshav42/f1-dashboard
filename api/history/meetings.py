from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json, asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from _openf1 import fetch_meetings
from datetime import datetime, timezone


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        year = int(params.get("year", [datetime.now(timezone.utc).year])[0])
        data = asyncio.run(fetch_meetings(year))
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass
