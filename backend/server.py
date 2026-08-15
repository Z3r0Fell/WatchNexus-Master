import os
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8002")

_client = httpx.AsyncClient(timeout=30.0)

@app.get("/health")
async def health():
    return {"status": "ok", "proxy": True}

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    if ".." in path or path.startswith("/"):
        return Response(content="Invalid path", status_code=400)

    url = f"{BACKEND_URL}/api/{path}"
    if request.url.query:
        url += f"?{request.url.query}"

    headers = dict(request.headers)
    headers.pop("host", None)
    body = await request.body()

    try:
        resp = await _client.request(
            method=request.method,
            url=url,
            headers=headers,
            content=body,
        )
    except httpx.TooManyRedirects:
        return Response(content="Too many redirects", status_code=502)
    except httpx.TimeoutException:
        return Response(content="Upstream timeout", status_code=504)
    except httpx.HTTPError as exc:
        return Response(content=f"Upstream error: {exc}", status_code=502)

    response = Response(content=resp.content, status_code=resp.status_code)
    response.raw_headers.clear()
    skip = {"content-length", "content-encoding", "transfer-encoding", "connection"}
    for key, value in resp.headers.multi_items():
        if key.lower() in skip:
            continue
        response.raw_headers.append((key.encode("latin-1"), value.encode("latin-1")))
    return response
