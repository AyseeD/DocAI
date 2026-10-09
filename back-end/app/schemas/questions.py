"""Request contract for a chat scoped to one selected document."""
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class Question(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    document_id: UUID

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value):
        value = " ".join(value.split())
        if not value:
            raise ValueError("Question must not be blank")
        return value
