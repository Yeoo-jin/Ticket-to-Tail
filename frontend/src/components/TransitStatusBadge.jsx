import { useEffect, useState } from 'react'
import { checkTransitStatus } from '../services/bookingApi'

// 편명·열차번호가 있는 예매 건만 실시간 지연 여부를 조회한다(부가 정보라 실패해도
// 화면 전체에는 영향 없이 해당 건만 "정보 없음"으로 조용히 넘어간다).
// onStatus는 조회가 끝날 때마다(성공/실패 모두) 호출되어, 상위 화면이 "지연된 예매가
// 있는지"를 모아서 판단할 수 있게 한다(예: 타임라인 화면의 "지연 반영" 버튼 노출 여부).
function TransitStatusBadge({ booking, onStatus }) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!booking.transitNumber) return undefined
    let cancelled = false
    checkTransitStatus(booking)
      .then((data) => {
        if (cancelled) return
        setStatus(data)
        onStatus?.(data)
      })
      .catch(() => {
        if (cancelled) return
        const fallback = { found: false }
        setStatus(fallback)
        onStatus?.(fallback)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

export default TransitStatusBadge
