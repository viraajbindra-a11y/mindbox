#!/usr/bin/env python3
# serve.py — static dev server for MindBox with caching DISABLED, so edited JS/CSS
# always loads fresh on reload. Python's stock `http.server` sends no Cache-Control,
# so browsers heuristically cache assets and silently serve STALE code while you're
# editing — which makes it look like your changes "didn't take". This serves the same
# files but tells the browser never to cache them.
#
#   python3 serve.py [port]      (default 8765; serves the folder this file lives in)
import http.server
import socketserver
import functools
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, *args):
        pass  # keep the console quiet


Handler = functools.partial(NoCacheHandler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True  # avoid "address in use" on quick restarts
with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as httpd:
    print(f'MindBox dev server (no-cache) at http://127.0.0.1:{PORT}  —  serving {ROOT}')
    httpd.serve_forever()
