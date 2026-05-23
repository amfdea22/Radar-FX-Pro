#!/usr/bin/env python3
"""FMP MCP Bridge — traduz chamadas REST para o protocolo MCP do FMP"""

import asyncio
import json
import os
import sys
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from fastmcp import Client

BRIDGE_PORT = int(os.environ.get("FMP_BRIDGE_PORT", "5556"))

# Event loop global compartilhado
_loop: asyncio.AbstractEventLoop | None = None
_client: Client | None = None
_fmp_api_key: str = os.environ.get("FMP_API_KEY", "38H3sDW3t09VitCF3QJe3f0X2g8ZlQJc")


def _mcp_url(key: str = None) -> str:
    return f"https://financialmodelingprep.com/mcp?apikey={key or _fmp_api_key}"


async def ensure_client(key: str = None):
    global _client, _fmp_api_key
    if key and key != _fmp_api_key:
        # API key mudou — recria o cliente
        _fmp_api_key = key
        if _client:
            await _client.__aexit__(None, None, None)
            _client = None
    if _client is None:
        _client = Client(_mcp_url(key))
        await _client.__aenter__()
    return _client


async def call_fmp(tool: str, args: dict = None, api_key: str = None) -> any:
    client = await ensure_client(api_key)
    result = await client.call_tool(tool, args or {})

    if hasattr(result, "content") and result.content:
        texts = []
        for c in result.content:
            text = None
            if hasattr(c, "text") and c.text:
                text = c.text
            elif isinstance(c, dict) and "text" in c:
                text = c["text"]
            if text:
                texts.append(json.loads(text))
        return texts[0] if len(texts) == 1 else texts
    return str(result)


def run_async(tool: str, args: dict, api_key: str = None) -> any:
    global _loop
    if _loop is None or _loop.is_closed():
        _loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_loop)
    return _loop.run_until_complete(call_fmp(tool, args, api_key))
    return _loop.run_until_complete(call_fmp(tool, args))


class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[FMP Bridge] %s\n" % (fmt % args))

    def _send(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode("utf-8"))

    def _parse_query(self) -> dict:
        parsed = self.path.split("?", 1)
        params = {}
        if len(parsed) > 1 and parsed[1]:
            for pair in parsed[1].split("&"):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    params[k] = v
        return params

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0].rstrip("/")
        params = self._parse_query()

        if path == "/health":
            self._send({"status": "OK", "message": "FMP Bridge conectado"})
            return

        prefix = "/api/fmp-bridge/"
        if not path.startswith(prefix):
            self._send({"error": "Endpoint inválido"}, 404)
            return

        cmd = path[len(prefix):]
        tool_name, _, ep = cmd.partition("/")
        if ep:
            params["endpoint"] = ep

        api_key = params.pop("apikey", None)
        endpoint = params.pop("endpoint", None)
        args = {}
        if endpoint:
            args["endpoint"] = endpoint
        args.update(params)

        self._coerce_types(args)

        try:
            result = run_async(tool_name, args, api_key)
            self._send(result)
        except Exception as e:
            traceback.print_exc()
            self._send({"error": str(e)}, 500)

    def _coerce_types(self, args: dict):
        NUMERIC = {"limit", "page", "periodLength", "year", "quarter", "cik", "count"}
        ARRAY = {"symbols", "ids"}
        for key in NUMERIC:
            if key in args and isinstance(args[key], str) and args[key].isdigit():
                args[key] = int(args[key])
        for key in ARRAY:
            if key in args and isinstance(args[key], str):
                args[key] = [s.strip() for s in args[key].split(",")]

    def do_POST(self):
        path = self.path.rstrip("/")
        body = {}
        length = self.headers.get("Content-Length")
        if length and int(length) > 0:
            body = json.loads(self.rfile.read(int(length)))

        prefix = "/api/fmp-bridge/"
        if not path.startswith(prefix):
            self._send({"error": "Endpoint inválido"}, 404)
            return

        cmd = path[len(prefix):]
        tool_name, _, ep = cmd.partition("/")
        if ep:
            body["endpoint"] = ep

        api_key = body.pop("apikey", None)
        endpoint = body.pop("endpoint", None)
        args = {}
        if endpoint:
            args["endpoint"] = endpoint
        args.update(body)
        self._coerce_types(args)

        try:
            result = run_async(tool_name, args, api_key)
            self._send(result)
        except Exception as e:
            traceback.print_exc()
            self._send({"error": str(e)}, 500)


def main():
    server = HTTPServer(("0.0.0.0", BRIDGE_PORT), BridgeHandler)
    print(f"[FMP Bridge] Rodando em http://0.0.0.0:{BRIDGE_PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[FMP Bridge] Encerrando...")
    finally:
        server.server_close()
        if _loop and not _loop.is_closed():
            _loop.run_until_complete(
                _client.__aexit__(None, None, None) if _client else asyncio.sleep(0)
            )
            _loop.close()


if __name__ == "__main__":
    main()
