#!/usr/bin/env python3
"""Local server: serves files + proxies AI requests to Pollinations.ai"""

import http.server
import json
import re
import urllib.request
import urllib.parse
import ssl
import os
import time

PORT = 8000

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE


def clean_response(text):
    """Clean up model response."""
    text = text.strip()
    # Remove thinking blocks
    text = re.sub(r'<think>[\s\S]*?</think>', '', text).strip()
    text = re.sub(r'<reasoning>[\s\S]*?</reasoning>', '', text).strip()
    # Strip reasoning before first code block
    if '```' in text:
        first_code = text.find('```')
        before = text[:first_code].strip()
        if before and len(before) > 20:
            starts = ['we ', 'i ', 'let', 'ok', 'sure', 'need', 'the ', 'this ',
                       'first', 'now', 'here', 'alright', "i'll", 'to ', 'below']
            if any(before.lower().startswith(w) for w in starts):
                text = text[first_code:]
    # Strip ads
    lines = text.split("\n")
    cleaned = [l for l in lines if not ("pollinations.ai" in l.lower() and len(l.strip()) < 200)
               and l.strip() not in ("---", "***", "___") and "\U0001f338" not in l]
    while cleaned and not cleaned[-1].strip():
        cleaned.pop()
    return "\n".join(cleaned).strip()


def shorten_for_code(messages):
    """Condense messages so the model outputs code instead of getting stuck reasoning."""
    shortened = []
    for m in messages:
        msg = dict(m)
        if msg["role"] == "user":
            text = msg["content"].strip()
            # Remove filler/instruction text, keep the core request short
            # The model works best with short direct prompts
            # Strip common verbose patterns
            for noise in ["please ", "can you ", "could you ", "i want you to ", "i need you to ",
                          "i would like ", "make sure to ", "make it ", "it should be ",
                          "with the following ", "that includes "]:
                text = re.sub(r'(?i)' + re.escape(noise), '', text)
            # Cap at 80 chars to prevent reasoning loops
            if len(text) > 80:
                # Keep first 80 chars but try to end at a word boundary
                cut = text[:80].rsplit(' ', 1)[0]
                text = cut
            msg["content"] = text.strip() + ". html code"
        shortened.append(msg)
    return shortened


def call_ai(messages):
    """Call Pollinations AI — tries POST then GET, auto-shortens long prompts."""
    import random

    short_messages = shorten_for_code(messages)
    # Get the shortened user prompt for GET fallback
    user_prompt = ""
    for m in short_messages:
        if m["role"] == "user":
            user_prompt = m["content"]

    # Method 1: POST (can return plain text or JSON)
    try:
        print("  Trying POST...")
        payload = json.dumps({
            "messages": short_messages,
            "model": "openai-fast",
            "seed": random.randint(1, 999999),
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://text.pollinations.ai/",
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=90, context=ssl_ctx) as resp:
            raw = resp.read().decode("utf-8").strip()
            result = _parse_response(raw)
            if result:
                print("  Got response (POST).")
                return result
            print("  POST returned unusable response.")
    except Exception as e:
        print(f"  POST failed: {e}")

    # Method 2: GET (always returns plain text, very reliable)
    time.sleep(3)
    try:
        print("  Trying GET...")
        encoded = urllib.parse.quote(user_prompt[:800], safe='')
        seed = random.randint(1, 999999)
        url = f"https://text.pollinations.ai/{encoded}?model=openai-fast&seed={seed}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=90, context=ssl_ctx) as resp:
            raw = resp.read().decode("utf-8").strip()
            result = _parse_response(raw)
            if result:
                print("  Got response (GET).")
                return result
            print("  GET returned unusable response.")
    except Exception as e:
        print(f"  GET failed: {e}")

    return None


def _parse_response(raw):
    """Parse API response — handles plain text, JSON with content, and reasoning extraction."""
    if not raw:
        return None
    # Plain text = best case
    if not raw.startswith("{"):
        return clean_response(raw)
    # JSON response
    try:
        data = json.loads(raw)
        # Check for actual content
        content = data.get("content", "")
        if "choices" in data:
            content = data["choices"][0]["message"].get("content", "")
        if content and content.strip():
            return clean_response(content)
        # No content — try extracting code from reasoning
        reasoning = data.get("reasoning_content", "")
        if reasoning:
            # Look for code blocks in reasoning
            blocks = re.findall(r'```(\w*)\n([\s\S]*?)```', reasoning)
            if blocks:
                result = ""
                for lang, code in blocks:
                    result += f"```{lang or 'html'}\n{code.strip()}\n```\n\n"
                return result.strip()
            # Look for raw HTML in reasoning
            if "<!DOCTYPE" in reasoning:
                idx = reasoning.find("<!DOCTYPE")
                code = reasoning[idx:]
                end = code.find("</html>")
                if end > 0:
                    code = code[:end + 7]
                return "```html\n" + code.strip() + "\n```"
    except:
        pass
    return None


class ChatHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/fs/home":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"home": os.path.expanduser("~")}).encode("utf-8"))
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/chat":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            messages = data.get("messages", [])

            reply = call_ai(messages)

            if reply:
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.end_headers()
                self.wfile.write(reply.encode("utf-8"))
            else:
                self.send_response(502)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"AI service unavailable. Try again.")

        elif self.path == "/api/fs/write":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            file_path = os.path.expanduser(data.get("path", ""))
            content = data.get("content", "")
            try:
                d = os.path.dirname(file_path)
                if d:
                    os.makedirs(d, exist_ok=True)
                with open(file_path, "w") as f:
                    f.write(content)
                result = {"success": True}
            except Exception as e:
                result = {"success": False, "error": str(e)}
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode("utf-8"))

        elif self.path == "/api/fs/mkdir":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            dir_path = os.path.expanduser(data.get("path", ""))
            try:
                os.makedirs(dir_path, exist_ok=True)
                result = {"success": True}
            except Exception as e:
                result = {"success": False, "error": str(e)}
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode("utf-8"))

        elif self.path == "/api/fs/delete":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            target = os.path.expanduser(data.get("path", ""))
            try:
                if os.path.isdir(target):
                    import shutil
                    shutil.rmtree(target)
                elif os.path.isfile(target):
                    os.remove(target)
                result = {"success": True}
            except Exception as e:
                result = {"success": False, "error": str(e)}
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode("utf-8"))

        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def handle(self):
        try:
            super().handle()
        except BrokenPipeError:
            pass

    def log_message(self, fmt, *args):
        if "favicon" not in str(args[0]):
            print(f"  {args[0]}")


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    http.server.HTTPServer.allow_reuse_address = True
    server = http.server.HTTPServer(("", PORT), ChatHandler)
    print(f"\n  Orbix AI Server")
    print(f"  Open: http://localhost:{PORT}")
    print(f"  Press Ctrl+C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
