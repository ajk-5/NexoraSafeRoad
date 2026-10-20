from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class Schema(BaseModel):
    """JSON is camelCase like the README examples; snake_case input (from the AI) is accepted too."""

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, from_attributes=True)
