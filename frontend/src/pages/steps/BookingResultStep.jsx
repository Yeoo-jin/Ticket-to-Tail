import { useEffect, useState } from 'react'
import CustomPlaceInput from '../../components/CustomPlaceInput'
import PlaceCard from '../../components/PlaceCard'
import TransitStatusBadge from '../../components/TransitStatusBadge'
import { fetchLayoverCandidates } from '../../services/timelineApi'

const TYPE_LABEL = { flight: '항공편', train: '열차' }

// datetime-local input은 초 단위가 없는 "YYYY-MM-DDTHH:MM" 형식을 쓰므로, 백엔드가 주는
// "YYYY-MM-DDTHH:MM:SS"와 서로 변환해준다.
function toDatetimeLocalValue(isoTime) {
  if (!isoTime) return ''
  return isoTime.slice(0, 16)
}

function fromDatetimeLocalValue(value) {
  if (!value) return null
  return `${value}:00`
}

function BookingResultStep({
  bookingResult,
  onUpdateBooking,
  layoverPlace,
  onSetLayoverPlace,
  onRemoveLayoverPlace,
  onBack,
  onNext,
}) {
  const { bookings, missingFields } = bookingResult
  const [layoverCandidates, setLayoverCandidates] = useState([])

  // 예매정보만으로(아직 동행 조건을 안 골랐어도) 환승 대기 시간에 넣을 만한 후보를
  // 미리 추천받는다. 매칭되는 환승 구간이 없으면 빈 배열이 오고, 그러면 검색 입력만 보여준다.
  // 필드를 직접 고칠 수 있게 되면서 bookings가 한 글자 칠 때마다 바뀌므로, 곧바로 다시
  // 조회하면 목록이 계속 깜빡이며 사라진다 - 입력이 잠시 멈춘 뒤에만 재조회한다.
  useEffect(() => {
    let cancelled = false
    if (!onSetLayoverPlace) return undefined
    const timer = setTimeout(() => {
      fetchLayoverCandidates(bookings)
        .then((data) => {
          if (!cancelled) setLayoverCandidates(data.candidates || [])
        })
        .catch(() => {
          if (!cancelled) setLayoverCandidates([])
        })
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
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
      <p className="mt-1 text-sm text-gray-500">AI가 분석한 결과예요. 틀린 값이 있으면 직접 고쳐주세요.</p>

      <ul className="mt-3 space-y-3">
        {bookings.map((booking, index) => (
          <li key={index} className="rounded-lg border border-gray-200 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={booking.type}
                onChange={(event) => onUpdateBooking(index, 'type', event.target.value)}
                className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                <option value="flight">{TYPE_LABEL.flight}</option>
                <option value="train">{TYPE_LABEL.train}</option>
              </select>
              <input
                type="text"
                value={booking.transitNumber || ''}
                onChange={(event) => onUpdateBooking(index, 'transitNumber', event.target.value || null)}
                placeholder="편명(선택)"
                className="w-24 rounded bg-[#f3ece2] px-2 py-0.5 text-xs text-[#7a6a55] focus:outline-none"
              />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-500">
                출발지
                <input
                  type="text"
                  value={booking.departureLocation || ''}
                  onChange={(event) => onUpdateBooking(index, 'departureLocation', event.target.value || null)}
                  placeholder="정보 없음"
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-[#1a1a1a] focus:outline-none"
                />
              </label>
              <label className="text-xs text-gray-500">
                도착지
                <input
                  type="text"
                  value={booking.arrivalLocation || ''}
                  onChange={(event) => onUpdateBooking(index, 'arrivalLocation', event.target.value || null)}
                  placeholder="정보 없음"
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-[#1a1a1a] focus:outline-none"
                />
              </label>
              <label className="text-xs text-gray-500">
                출발 시각
                <input
                  type="datetime-local"
                  value={toDatetimeLocalValue(booking.departureTime)}
                  onChange={(event) =>
                    onUpdateBooking(index, 'departureTime', fromDatetimeLocalValue(event.target.value))
                  }
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-[#1a1a1a] focus:outline-none"
                />
              </label>
              <label className="text-xs text-gray-500">
                도착 시각
                <input
                  type="datetime-local"
                  value={toDatetimeLocalValue(booking.arrivalTime)}
                  onChange={(event) =>
                    onUpdateBooking(index, 'arrivalTime', fromDatetimeLocalValue(event.target.value))
                  }
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-[#1a1a1a] focus:outline-none"
                />
              </label>
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
