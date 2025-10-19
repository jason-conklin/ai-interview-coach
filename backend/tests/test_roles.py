import pytest

pytestmark = pytest.mark.anyio


async def test_list_roles(client):
    response = await client.get("/api/v1/roles")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(role["slug"] == "software-developer" for role in data)
