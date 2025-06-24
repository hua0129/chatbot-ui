from pydantic import BaseModel

class QueryRequest(BaseModel):
    user_input: str
    model: str = "huggingface"  # default value