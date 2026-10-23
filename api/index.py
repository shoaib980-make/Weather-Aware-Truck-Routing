import os
import sys
from pathlib import Path

# Add backend directory and root directory to sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
for p in (str(backend_dir), str(root_dir)):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
app = application

# Auto-migrate SQLite schema in temp directory when running on Vercel serverless
if os.environ.get("VERCEL"):
    try:
        from django.core.management import call_command
        call_command("migrate", interactive=False)
    except Exception as e:
        print("Vercel auto-migrate notice:", e)
