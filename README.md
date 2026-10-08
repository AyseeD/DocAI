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

## Create DB and connect to docker
Create the db in pgadmin called "docai". 
Fix the docker files: 
- Add an actual compose.yml using the example file as a template replace sections with your own db info
- Create your own .env file and add you db password (also ai info with model name and api key)
- Run docker 
```bash
cd back-end
cp .env.example .env #to copy the env example into an actual .env file (skip if already exists )
docker compose up --build -d
```