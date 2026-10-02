from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hello world"}

@app.post("/string")
def testString(string: str):
    return {"message": f"Hello {string}"}