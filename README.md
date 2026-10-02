create environment in backend/ and download requirements:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run backend 
```bash
cd app
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Get swagger ui docs open:
```bash 
http://127.0.0.1:8000/docs
```