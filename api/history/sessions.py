from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json, asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from _openf1 import fetch_sessions_for_meeting


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        meeting_key = int(params.get("meeting_key", [0])[0])
        data = asyncio.run(fetch_sessions_for_meeting(meeting_key))
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass
