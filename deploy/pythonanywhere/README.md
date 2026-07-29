# CyberGrid Integrity Presence on PythonAnywhere

This small Flask service supplies server-authoritative active-player presence and
the shared Integrity Construct state to the GitHub Pages client.

PythonAnywhere setup:

1. Clone the repository into `/home/<username>/cybergrid-strike-game`.
2. Create a virtual environment and install `deploy/pythonanywhere/requirements.txt`.
3. Configure the web app's WSGI file to import `application` from
   `deploy/pythonanywhere/wsgi.py`.
4. Reload the web app.
5. Set the GitHub Actions repository variable `ECOSYSTEM_API_URL` to
   `https://<username>.pythonanywhere.com/api`.

SQLite data is stored beside `app.py` by default. Set `CYBERGRID_DATA_DIR` to a
writable persistent directory to put it elsewhere.
