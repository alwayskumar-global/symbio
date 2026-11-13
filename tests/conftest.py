import pytest
import relate

from symbio.evaluations import transaction
from symbio.graph import build, discover, inputs


@pytest.fixture
def db():
    with relate.connect() as db:
        with transaction(db):
            build(db)
        yield db


@pytest.fixture
def model(db):
    return (
        inputs(db),
        {"yeast": "supplier-yeast", "gro": "supplier-gro"},
        discover(db)["site-a-intake-2000"],
    )
