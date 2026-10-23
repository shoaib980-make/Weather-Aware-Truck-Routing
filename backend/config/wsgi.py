import os
import sys
from pathlib import Path

# Add backend directory and parent root to sys.path so 'config' and other modules can always be imported
BASE_DIR = Path(__file__).resolve().parent.parent
for p in (str(BASE_DIR), str(BASE_DIR.parent)):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
app = application

# Auto-migrate SQLite schema in temp directory when running on Vercel
if os.environ.get("VERCEL"):
    try:
        from django.core.management import call_command
        call_command("migrate", interactive=False)
    except Exception as e:
        print("Vercel auto-migrate notice:", e)


