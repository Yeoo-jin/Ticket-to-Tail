import { useEffect, useState } from 'react'
import CustomPlaceInput from '../../components/CustomPlaceInput'
import PlaceCard from '../../components/PlaceCard'
import TransitStatusBadge from '../../components/TransitStatusBadge'
import { fetchLayoverCandidates } from '../../services/timelineApi'

const TYPE_LABEL = { flight: '항공편', train: '열차' }

function BookingResultStep({ bookingResult, layoverPlace, onSetLayoverPlace, onRemoveLayoverPlace, onBack, onNext }) {
  const { bookings, missingFields } = bookingResult
  const [layoverCandidates, setLayoverCandidates] = useState([])

  // 예매정보만으로(아직 동행 조건을 안 골랐어도) 환승 대기 시간에 넣을 만한 후보를
  // 미리 추천받는다. 매칭되는 환승 구간이 없으면 빈 배열이 오고, 그러면 검색 입력만 보여준다.
  useEffect(() => {
    let cancelled = false
    if (!onSetLayoverPlace) return undefined
    fetchLayoverCandidates(bookings)
      .then((data) => {
        if (!cancelled) setLayoverCandidates(data.candidates || [])
      })
      .catch(() => {
        if (!cancelled) setLayoverCandidates([])
      })
    return () => {
      cancelled = true
    }
  }, [bookings, onSetLayoverPlace])

  function handlePickLayoverCandidate(place) {
    onSetLayoverPlace({
      name: place.name,
      address: place.address || null,
      lat: place.lat ?? null,
      lng: place.lng ?? null,
    })
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">📋 구조화된 예매정보 확인</h2>
      <p className="mt-1 text-sm text-gray-500">AI가 분석한 결과예요. 이상이 없는지 확인해주세요.</p>

      <ul className="mt-3 space-y-2">
        {bookings.map((booking, index) => (
          <li key={index} className="rounded-lg border border-gray-200 p-3 text-sm">
            <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {TYPE_LABEL[booking.type] || booking.type}
            </span>
            {booking.transitNumber && (
              <span className="ml-1.5 inline-block rounded bg-[#f3ece2] px-2 py-0.5 text-xs text-[#7a6a55]">
                {booking.transitNumber}
              </span>
            )}
            <div className="mt-1 text-gray-700">
              출발: {booking.departureLocation || '정보 없음'}
              {' · '}
              {booking.departureTime || '시간 미확인'}
            </div>
            <div className="text-gray-700">
              도착: {booking.arrivalLocation || '정보 없음'}
              {' · '}
              {booking.arrivalTime || '시간 미확인'}
            </div>
            <TransitStatusBadge booking={booking} />
          </li>
        ))}
      </ul>

      {onSetLayoverPlace && (
        <div className="mt-3 rounded-lg border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-900">환승 대기 시간에 들를 곳 (선택)</p>
          <p className="mt-1 text-xs text-gray-500">
            항공편↔열차 환승 사이 시간이 남으면 이 장소를 우선 채워요. 입력 안 해도 자동으로 채워질 수 있어요.
          </p>
          {layoverPlace ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#1a1a1a] bg-[#f3ece2] px-3 py-1 text-xs text-[#1a1a1a]">
              {layoverPlace.name}
              <button type="button" onClick={onRemoveLayoverPlace} aria-label="환승 대기 장소 삭제">
                ×
              </button>
            </span>
          ) : (
            <>
              {layoverCandidates.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {layoverCandidates.map((place) => (
                    <PlaceCard
                      key={place.placeId}
                      place={place}
                      selected={false}
                      onToggle={() => handlePickLayoverCandidate(place)}
                    />
                  ))}
                </div>
              )}
              <CustomPlaceInput placeholder="직접 검색해서 추가하기" onAdd={onSetLayoverPlace} />
            </>
          )}
        </div>
      )}

      {missingFields.length > 0 && (
        <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
          다음 정보가 텍스트에서 확인되지 않았어요: {missingFields.join(', ')}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700"
        >
          다시 입력
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-lg bg-[#1a1a1a] py-2.5 text-sm text-white"
        >
          다음 (동행 조건 선택)
        </button>
      </div>
    </section>
  )
}

export default BookingResultStep
