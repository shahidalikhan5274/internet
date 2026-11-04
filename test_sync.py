import subprocess
import time
import urllib.request
import json
import tempfile
import shutil
from websockets.sync.client import connect

temp_dir = tempfile.mkdtemp()
cmd = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '--headless=new',
    '--remote-debugging-port=9229',
    '--user-data-dir=' + temp_dir,
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:5500/index.html'
]
proc = subprocess.Popen(cmd)
time.sleep(2)

try:
    req = urllib.request.urlopen('http://localhost:9229/json')
    targets = json.loads(req.read().decode('utf-8'))
    page = next(t for t in targets if t.get('type') == 'page')
    ws_url = page['webSocketDebuggerUrl']
    print('Connecting to:', ws_url, flush=True)

    with connect(ws_url) as ws:
        ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))
        ws.send(json.dumps({"id": 2, "method": "Console.enable"}))

        def send_eval(expr):
            mid = int(time.time() * 1000) % 100000
            ws.send(json.dumps({"id": mid, "method": "Runtime.evaluate", "params": {"expression": expr, "returnByValue": True}}))
            while True:
                msg = json.loads(ws.recv(timeout=5))
                if msg.get("id") == mid:
                    return msg.get("result", {}).get("result", {}).get("value")
                if "method" in msg:
                    m = msg["method"]
                    if m == "Runtime.consoleAPICalled":
                        args = [a.get("value", a.get("description", "")) for a in msg["params"]["args"]]
                        print("[CONSOLE]", *args, flush=True)
                    elif m == "Runtime.exceptionThrown":
                        print("[EXCEPTION]", msg["params"]["exceptionDetails"], flush=True)

        print("Testing window.app state...", flush=True)
        app_state = send_eval("window.app ? {users: window.app.data.users.length, tab: window.app.activeTab} : null")
        print("App state:", app_state, flush=True)

        print("Testing click on customers tab...", flush=True)
        t0 = time.time()
        click_res = send_eval("(() => { document.querySelector('.nav-item[data-tab=\"customers\"]').click(); return window.app.activeTab; })()")
        print(f"Tab switched to: {click_res} in {time.time() - t0:.3f}s", flush=True)

        print("Testing table rows...", flush=True)
        rows_count = send_eval("document.getElementById('customersTableBody').children.length")
        print("Rendered rows:", rows_count, flush=True)

finally:
    proc.terminate()
    time.sleep(0.5)
    shutil.rmtree(temp_dir, ignore_errors=True)
