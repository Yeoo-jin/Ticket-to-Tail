import { categoryIcon } from '../utils/placeDisplay'

function PlaceCard({ place, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(place.placeId)}
      className={`flex flex-col rounded-xl border p-3 text-left shadow-sm transition ${
        selected ? 'border-[#1a1a1a] bg-[#f3ece2] ring-2 ring-[#ded6c8]' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex h-20 items-center justify-center rounded-lg bg-gray-100 text-3xl sm:h-24">
        {place.imageUrl ? (
          <img src={place.imageUrl} alt={place.name} className="h-full w-full rounded-lg object-cover" />
        ) : (
          <span aria-hidden="true">{categoryIcon(place.category)}</span>
        )}
      </div>

      <div className="mt-2 flex items-start justify-between gap-1">
        <h3 className="text-sm font-semibold text-gray-900">{place.name}</h3>
        {selected && (
          <span className="shrink-0 rounded-full bg-[#1a1a1a] px-2 py-0.5 text-[10px] text-white">선택됨</span>
        )}
      </div>

      <p className="mt-1 text-xs text-gray-500">
        {place.category} · 약 {place.estimatedDurationMinutes}분
      </p>

      <p className="mt-1 line-clamp-3 text-xs text-gray-700">{place.recommendationReason}</p>

      {place.tags?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {place.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {(place.openTime || place.closeTime) && (
        <p className="mt-2 text-[10px] text-gray-400">
          운영시간(예시) {place.openTime}–{place.closeTime}
        </p>
      )}
    </button>
  )
}

export default PlaceCard
