import argparse
import os
import socket
import threading
import time
import urllib.request
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


def get_default_workdir():
    env_workdir = os.environ.get("AICODER_WORKDIR")
    if env_workdir:
        return str(Path(env_workdir).resolve())
    return str(Path(__file__).resolve().parents[1])


def open_browser_when_ready(url, timeout_seconds=15):
    deadline = time.time() + timeout_seconds
    health_url = f"{url}/api/state"

    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health_url, timeout=1):
                webbrowser.open(url)
                return
        except Exception:
            time.sleep(0.5)

    webbrowser.open(url)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run the shikumi Django backend locally.")
    parser.add_argument("--port", type=int, default=9080)
    parser.add_argument("--dir", dest="workdir", default=get_default_workdir())
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args(argv)

    os.environ["AICODER_WORKDIR"] = str(Path(args.workdir).resolve())
    os.environ["AICODER_LOCAL_MODE"] = "1"

    application = get_wsgi_application()
    port = find_listener_port(args.port)
    url = f"http://127.0.0.1:{port}"

    print(f"shikumi Django backend launching on {url}")
    print(f"Working dir: {os.environ['AICODER_WORKDIR']}")

    with make_server("127.0.0.1", port, application) as httpd:
        if not args.no_browser:
            threading.Thread(target=open_browser_when_ready, args=(url,), daemon=True).start()
        httpd.serve_forever()


if __name__ == "__main__":
    main()
