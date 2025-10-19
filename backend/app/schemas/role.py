from app.schemas.common import ORMModel


class RoleRead(ORMModel):
    id: int
    name: str
    slug: str
    description: str | None = None


class RoleListResponse(ORMModel):
    roles: list[RoleRead]
