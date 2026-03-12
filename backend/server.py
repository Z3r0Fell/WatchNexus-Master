# This file is a placeholder. The actual backend is the C# server.
# The C# backend runs via the 'watchnexus-server' supervisor program.
# See: /app/src/watchnexus/core/
from fastapi import FastAPI
app = FastAPI()

@app.get("/api/health")
async def health():
    return {"status": "redirected", "message": "Use watchnexus-server supervisor program"}
