#!/usr/bin/env python3
"""
Chess Online - Serveur HTTP simplifié pour Vercel
"""

import os
from pathlib import Path
from aiohttp import web

# --- Configuration ---
PORT = int(os.environ.get("PORT", 8080))
STATIC_DIR = Path(__file__).parent / "static"

# --- Classement local ---
leaderboard = []

# --- Routes ---
async def index_handler(request):
    return web.FileResponse(STATIC_DIR / "index.html")

async def ranking_handler(request):
    return web.json_response({"ranking": leaderboard})

async def update_ranking_handler(request):
    try:
        data = await request.json()
        username = data.get("username")
        score = data.get("score", 0)
        if username:
            leaderboard.append({"username": username, "score": score})
            leaderboard.sort(key=lambda x: x["score"], reverse=True)
            return web.json_response({"status": "success"})
        return web.json_response({"error": "Invalid data"}, status=400)
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)

# --- App factory ---
def create_app():
    app = web.Application()
    app.router.add_get("/", index_handler)
    app.router.add_get("/api/ranking", ranking_handler)
    app.router.add_post("/api/update-ranking", update_ranking_handler)
    app.router.add_static("/", STATIC_DIR, show_index=False)
    return app

if __name__ == "__main__":
    print("=" * 50)
    print("  ♛  CHESS ONLINE - Serveur Simplifié  ♛")
    print("=" * 50)
    print(f"  PORT detected: {PORT}")
    print(f"  Binding to: http://0.0.0.0:{PORT}")
    print("=" * 50)

    app = create_app()
    web.run_app(
        app, 
        host="0.0.0.0", 
        port=PORT,
        access_log=None
    )
