import contextlib
import functools
import http.server
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request


def request(method, url, data=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            return json.load(response)["value"]
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error


def until(check, timeout=40):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = check()
        if value:
            return value
        time.sleep(.15)
    raise AssertionError("Timed out waiting for " + check.__name__)


class StaticSite(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".mjs": "application/javascript", ".wasm": "application/wasm"}

    def log_message(self, *args):
        pass


def run(browser):
    is_safari = browser == "safari"
    executable = shutil.which("safaridriver" if is_safari else "geckodriver")
    if not executable:
        raise RuntimeError("WebDriver executable unavailable")
    caps = {"browserName": browser}
    if not is_safari:
        caps["moz:firefoxOptions"] = {"args": ["-headless"]}
    origin = "http://127.0.0.1:4455"
    handler = functools.partial(StaticSite, directory=str(Path("dist").resolve()))
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as site:
        threading.Thread(target=site.serve_forever, daemon=True).start()
        home = f"http://127.0.0.1:{site.server_port}/"
        driver = subprocess.Popen([executable, "--port", "4455"])
        def ready():
            try:
                return request("GET", origin + "/status").get("ready")
            except (OSError, RuntimeError):
                return False
        try:
            until(ready)
            info = request("POST", origin + "/session", {"capabilities": {"alwaysMatch": caps}})
            session = origin + "/session/" + info["sessionId"]
            def call(path, data):
                return request("POST", session + path, data)
            def js(script):
                return call("/execute/sync", {"script": "return " + script, "args": []})
            def visit(route):
                call("/url", {"url": home + route})
                until(lambda: js("document.readyState==='complete'&&!document.body.inert"))
            def click(css):
                remote = call("/element", {"using": "css selector", "value": css})
                key = remote["element-6066-11e4-a52e-4f735466cecf"]
                call("/element/" + key + "/click", {})
            try:
                visit("workshop/index.html")
                assert js("document.querySelector('h1').textContent") == "Packaging workshop"
                click("#reference")
                click('#confirm button[value="replace"]')
                click("#carton")
                click("#checkpoint")
                for _ in range(4):
                    click("#second")
                assert js("document.querySelectorAll('#readings strong')[2].textContent") == "1"
                click("#save")
                visit("workshop/index.html")
                assert js("document.querySelectorAll('#readings strong')[2].textContent") == "1"
                visit("workshop/site/index.html")
                click("#sample")
                assert js("document.querySelectorAll('#tree option').length") == 11
                visit("workshop/cad/index.html")
                click("#load")
                until(lambda: js("document.querySelector('#dimensions').textContent.includes('0.1000')"))
                click("#mount")
                until(lambda: js("document.querySelector('#cad-info')?.textContent.includes('0.100 m')"))
                visit("workshop/infrastructure/index.html")
                assert js("document.querySelector('h1').textContent").strip()
                print(json.dumps({"browser": browser, "version": info["capabilities"]["browserVersion"], "platform": info["capabilities"]["platformName"], "checks": ["PLC edge count", "persisted run", "site assembly", "STEP conversion and transfer", "rack entry"]}))
            finally:
                request("DELETE", session)
        finally:
            driver.terminate()
            with contextlib.suppress(subprocess.TimeoutExpired):
                driver.wait(timeout=5)
            site.shutdown()


if __name__ == "__main__":
    run(sys.argv[1])
