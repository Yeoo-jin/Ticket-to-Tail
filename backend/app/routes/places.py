from fastapi import APIRouter

from app.schemas.place import PlaceRecommendRequest, PlaceRecommendResponse
from app.services.place_recommendation_service import get_place_recommendations

router = APIRouter(prefix="/api/places", tags=["places"])


@router.post("/recommend", response_model=PlaceRecommendResponse)
def recommend_places(request: PlaceRecommendRequest) -> PlaceRecommendResponse:
    data = get_place_recommendations(request)
    return PlaceRecommendResponse(data=data)
