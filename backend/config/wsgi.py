import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()
app = application

# Auto-migrate SQLite schema in temp directory when running on Vercel
if os.environ.get("VERCEL"):
    try:
        from django.core.management import call_command
        call_command("migrate", interactive=False)
    except Exception as e:
        print("Vercel auto-migrate notice:", e)

