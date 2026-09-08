"""Development-only static server for the browser workspace POC."""
from argparse import ArgumentParser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import mimetypes

mimetypes.add_type("application/wasm", ".wasm")
root = Path(__file__).resolve().parent

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=root, **kwargs)
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

if __name__ == "__main__":
    parser = ArgumentParser(); parser.add_argument("--port", type=int, default=8012)
    args = parser.parse_args()
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
