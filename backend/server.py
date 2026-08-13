import os

import httpx
from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Same-origin reverse proxy. Restrict CORS to explicit origins (never wildcard
# with credentials, which the Fetch spec forbids). CORS_ORIGINS is a
# comma-separated allowlist; defaults to none (same-origin needs no CORS).
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8002")

@app.get("/health")
async def health():
    return {"status": "ok", "proxy": True}

@app.websocket("/ws/{path:path}")
async def websocket_proxy(websocket: WebSocket, path: str):
    await websocket.accept()
    target_url = f"{BACKEND_URL}/ws/{path}"
    if websocket.query_params:
        target_url += f"?{websocket.query_params}"
    
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            async with client.stream("GET", target_url, headers=dict(websocket.headers)) as backend_ws:
                while True:
                    try:
                        data = await websocket.receive_bytes()
                        await backend_ws.send_bytes(data)
                    except WebSocketDisconnect:
                        break
                    
                    try:
                        backend_data = await backend_ws.aread()
                        if backend_data:
                            await websocket.send_bytes(backend_data)
                    except Exception:
                        break
        except Exception:
            await websocket.close()

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    url = f"{BACKEND_URL}/api/{path}"
    if request.url.query:
        url += f"?{request.url.query}"

    headers = dict(request.headers)
    headers.pop("host", None)
    body = await request.body()

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.request(
            method=request.method,
            url=url,
            headers=headers,
            content=body,
        )

    # Preserve headers individually so MULTIPLE Set-Cookie headers (auth +
    # CSRF cookies) survive. dict(resp.headers) would fold duplicates into one
    # comma-joined value, which browsers parse as a single malformed cookie.
    response = Response(content=resp.content, status_code=resp.status_code)
    response.raw_headers.clear()
    skip = {"content-length", "content-encoding", "transfer-encoding", "connection"}
    for key, value in resp.headers.multi_items():
        if key.lower() in skip:
            continue
        response.raw_headers.append((key.encode("latin-1"), value.encode("latin-1")))
    return response
