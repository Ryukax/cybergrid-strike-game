"""Mount CyberGrid's API without replacing the account's existing dashboard."""

import os
import sys

HOME = "/home/LordAlphaSupremeI"
CYBERGRID_SERVICE = f"{HOME}/cybergrid-strike-game/deploy/pythonanywhere"

for path in (HOME, CYBERGRID_SERVICE):
    if path not in sys.path:
        sys.path.insert(0, path)

# Preserve the existing dashboard configuration and application.
os.environ["BOT_LOG"] = f"{HOME}/volatile_bot_v2.log"
os.environ["BOT_STATE"] = f"{HOME}/volatile_bot_v2_state.json"
os.environ["CALM_LOG"] = f"{HOME}/volatile_calm.log"

from equity_dashboard_flask import app as dashboard_application
from app import app as presence_application


def application(environ, start_response):
    if environ.get("PATH_INFO", "").startswith("/api/"):
        return presence_application(environ, start_response)
    return dashboard_application(environ, start_response)
