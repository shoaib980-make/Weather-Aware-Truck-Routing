import os
import sys
from pathlib import Path

# Add backend directory to sys.path so config and routing modules can be imported
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Auto-migrate SQLite schema in /tmp when running on Vercel serverless
if os.environ.get("VERCEL"):
    try:
        from django.core.management import call_command
        call_command("migrate", interactive=False)
    except Exception as e:
        print("Vercel auto-migrate notice:", e)

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
app = application
