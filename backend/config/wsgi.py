import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Auto-migrate SQLite schema in /tmp when running on Vercel
if os.environ.get("VERCEL"):
    try:
        from django.core.management import call_command
        call_command("migrate", interactive=False)
    except Exception as e:
        print("Vercel auto-migrate notice:", e)

application = get_wsgi_application()
app = application

