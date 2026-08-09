import { useEffect, useState } from 'react'
import { checkTransitStatus } from '../../services/bookingApi'

const TYPE_LABEL = { flight: '항공편', train: '열차' }

// 편명·열차번호가 있는 예매 건만 실시간 지연 여부를 조회한다(부가 정보라 실패해도
// 화면 전체에는 영향 없이 해당 건만 "정보 없음"으로 조용히 넘어간다).
function TransitStatusBadge({ booking }) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!booking.transitNumber) return undefined
    let cancelled = false
    checkTransitStatus(booking)
      .then((data) => {
        if (!cancelled) setStatus(data)
      })
      .catch(() => {
        if (!cancelled) setStatus({ found: false })
      })
    return () => {
      cancelled = true
    }
  }, [booking])

  if (!booking.transitNumber) return null
  if (!status) {
    return <p className="mt-1 text-xs text-gray-400">실시간 상태 확인 중...</p>
  }
  if (!status.found) return null

  return (
    <p className={`mt-1 text-xs ${status.delayed ? 'font-medium text-red-600' : 'text-green-700'}`}>{status.message}</p>
  )
}

function BookingResultStep({ bookingResult, onBack, onNext }) {
  const { bookings, missingFields } = bookingResult

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">2. 구조화된 예매정보 확인</h2>
      <p className="mt-1 text-sm text-gray-500">AI가 분석한 결과예요. 이상이 없는지 확인해주세요.</p>

      <ul className="mt-3 space-y-2">
        {bookings.map((booking, index) => (
          <li key={index} className="rounded-lg border border-gray-200 p-3 text-sm">
            <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {TYPE_LABEL[booking.type] || booking.type}
            </span>
            {booking.transitNumber && (
              <span className="ml-1.5 inline-block rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
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
          className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm text-white"
        >
          다음 (동행 조건 선택)
        </button>
      </div>
    </section>
  )
}

export default BookingResultStep
