from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import TitleCreate, ItemCreate
from app.services.catalog import create_title, create_item_copy, get_item_by_identifier, generate_spine_label_data
from app.services.search import search_catalog, get_virtual_bookshelf

router = APIRouter(prefix="/api/v1/catalog", tags=["Cataloguing & Search"])

@router.get("/search")
def opac_search(
    q: Optional[str] = Query(None, description="Full-text query"),
    category: Optional[str] = Query(None, description="Filter category"),
    available_only: bool = Query(False, description="Filter available copies only"),
    limit: int = 50,
    offset: int = 0
):
    return search_catalog(query=q, category=category, available_only=available_only, limit=limit, offset=offset)

@router.get("/shelf/{shelf_id}")
def virtual_shelf(shelf_id: str):
    return get_virtual_bookshelf(shelf_id)

@router.post("/titles")
def add_title(title_in: TitleCreate):
    try:
        return create_title(title_in)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/items")
def add_item_copy(item_in: ItemCreate):
    try:
        return create_item_copy(item_in)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/items/{identifier}")
def get_item(identifier: str):
    item = get_item_by_identifier(identifier)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.get("/items/{accession_number}/spine-label")
def get_spine_label(accession_number: str):
    try:
        return generate_spine_label_data(accession_number)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
