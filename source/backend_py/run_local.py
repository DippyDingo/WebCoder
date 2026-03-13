import argparse
import os
import socket
import threading
import time
import webbrowser
from pathlib import Path
from wsgiref.simple_server import make_server

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.wsgi import get_wsgi_application


def find_listener_port(preferred_port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", preferred_port))
            return preferred_port
        except OSError:
            sock.bind(("127.0.0.1", 0))
            return sock.getsockname()[1]


def main():
    parser = argparse.ArgumentParser(description="Run the AiCoder Django backend locally.")
    parser.add_argument("--port", type=int, default=9080)
    parser.add_argument("--dir", dest="workdir", default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    os.environ["AICODER_WORKDIR"] = str(Path(args.workdir).resolve())
    os.environ["AICODER_LOCAL_MODE"] = "1"

    application = get_wsgi_application()
    port = find_listener_port(args.port)
    url = f"http://127.0.0.1:{port}"

    print(f"AiCoder Django backend launching on {url}")
    print(f"Working dir: {os.environ['AICODER_WORKDIR']}")

    if not args.no_browser:
        threading.Thread(target=lambda: (time.sleep(0.5), webbrowser.open(url)), daemon=True).start()

    with make_server("127.0.0.1", port, application) as httpd:
        httpd.serve_forever()


if __name__ == "__main__":
    main()
