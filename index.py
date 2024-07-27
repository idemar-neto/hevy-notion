from fastapi import FastAPI

app = FastAPI()

@app.get("/api/test")
def hello_world():
    return "Hello, world!"