import { useState } from 'react'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingIndicator from '../../components/LoadingIndicator'
import ShareButton from '../../components/ShareButton'
import StationFacilities from '../../components/StationFacilities'
import TransitStatusBadge from '../../components/TransitStatusBadge'
import TripMap from '../../components/TripMap'
import { createTimelineShare } from '../../services/shareApi'
import { companionTypeLabels } from '../../utils/companionTypes'
import { formatBookingLabel } from '../../utils/bookingDelay'
import { TIMELINE_TYPE_LABEL, dateKey, formatDateHeader, formatTime } from '../../utils/timelineDisplay'

const TYPE_STYLE = {
  arrival: 'bg-sky-100 text-sky-700',
  transport: 'bg-gray-100 text-gray-600',
  attraction: 'bg-blue-100 text-blue-700',
  meal: 'bg-orange-100 text-orange-700',
  rest: 'bg-green-100 text-green-700',
  departure: 'bg-sky-100 text-sky-700',
  accommodation: 'bg-purple-100 text-purple-700',
}

function TimelineResultStep({
  timelineData,
  destination,
  onRegenerate,
  onReselectPlaces,
  loading,
  error,
  placeCoordinates,
  bookings,
  onApplyDelay,
}) {
  const timeline = timelineData?.timeline ?? []
  const summary = timelineData?.summary
  const warnings = timelineData?.warnings ?? []
  const stationFacilities = timelineData?.stationFacilities ?? []

  // bookings 배열 안에서의 위치(index) -> 사용자가 입력한 지연 분. 예매가 서울↔부산
  // 열차, 인천↔김해 항공편처럼 여러 개일 수 있어 transitNumber가 아니라 index로 매칭한다
  // (편명이 없는 예매도 있을 수 있어서).
  const [delayMinutesByIndex, setDelayMinutesByIndex] = useState({})
  const [applyingDelay, setApplyingDelay] = useState(false)
  const allBookings = bookings || []
  // "0분"으로 입력해서 원래 시각으로 되돌리는 것도 유효한 반영이므로, 값이 0보다 큰지가
  // 아니라 사용자가 입력칸을 한 번이라도 건드렸는지(빈 문자열이 아닌지)로 활성화를 판단한다.
  const hasDelayInput = Object.values(delayMinutesByIndex).some((value) => value !== '' && value != null)

  function handleChangeDelayMinutes(index, value) {
    setDelayMinutesByIndex((prev) => ({ ...prev, [index]: value }))
  }

  // 실시간 조회에서 지연이 확인되면 그 값을 입력칸에 참고용으로 채워준다 — 사용자가 이미
  // 직접 입력했으면(0이 아니면) 덮어쓰지 않는다.
  function handleStatus(index, status) {
    if (!status.delayed || !status.delayMinutes) return
    setDelayMinutesByIndex((prev) => (prev[index] ? prev : { ...prev, [index]: status.delayMinutes }))
  }

  async function handleApplyDelay() {
    setApplyingDelay(true)
    try {
      const numeric = Object.fromEntries(
        Object.entries(delayMinutesByIndex)
          .map(([index, minutes]) => [index, Number(minutes)])
          .filter(([, minutes]) => minutes > 0),
      )
      await onApplyDelay?.(numeric)
    } finally {
      setApplyingDelay(false)
    }
  }

  let lastDateKey = null

  async function handleCreateShare() {
    const { shareId } = await createTimelineShare({ destination, timeline, summary })
    const url = `${window.location.origin}/share/timeline/${shareId}`
    return {
      url,
      title: `${destination} 여행 타임라인`,
      description: summary
        ? `관광지 ${summary.placeCount}곳 · 관광시간 ${summary.sightseeingMinutes}분`
        : '완성된 여행 타임라인을 확인해보세요.',
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">🗺️ 맞춤 타임라인</h2>
        <ShareButton label="공유" disabled={timeline.length === 0} onCreateShare={handleCreateShare} />
      </div>

      {summary && (
        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          <p>관광지 {summary.placeCount}곳</p>
          <p>
            {companionTypeLabels(summary.companionTypes).join(' · ')} ·{' '}
            {summary.pace === 'relaxed' ? '여유롭게' : '보통'}
          </p>
        </div>
      )}

      <StationFacilities stationFacilities={stationFacilities} />

      {allBookings.length > 0 && (
        <div className="mt-2 rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-semibold text-gray-900">🚉 지연 반영</p>
          <p className="mt-1 text-[11px] text-gray-500">
            어떤 예매가 지연됐는지 아래에서 골라 지연 시간(분)을 입력하고 반영하세요.
          </p>
          <ul className="mt-2 space-y-2">
            {allBookings.map((booking, index) => (
              <li key={`${booking.type}-${booking.transitNumber || index}-${index}`} className="text-xs text-gray-700">
                <p className="font-medium">{formatBookingLabel(booking)}</p>
                {booking.transitNumber && (
                  <TransitStatusBadge booking={booking} onStatus={(status) => handleStatus(index, status)} />
                )}
                <label className="mt-1 flex items-center gap-2">
                  <span className="text-gray-500">지연(분)</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={delayMinutesByIndex[index] ?? ''}
                    onChange={(event) => handleChangeDelayMinutes(index, event.target.value)}
                    placeholder="0"
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:border-[#1a1a1a] focus:outline-none"
                  />
                </label>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleApplyDelay}
            disabled={applyingDelay || loading || !hasDelayInput}
            className="mt-3 w-full rounded-lg bg-[#1a1a1a] py-2 text-xs font-medium text-white disabled:opacity-40"
          >
            {applyingDelay ? '반영하는 중...' : '지연 반영해서 타임라인 다시 만들기'}
          </button>
        </div>
      )}

      <ErrorMessage message={error} />

      {warnings.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingIndicator label="타임라인을 생성하는 중..." />
      ) : (
        <>
          {timeline.length > 0 && (
            <div className="mt-3">
              <TripMap timeline={timeline} placeCoordinates={placeCoordinates || {}} />
            </div>
          )}
          <ol className="mt-3 space-y-2">
            {timeline.map((item) => {
              const key = dateKey(item.startTime)
              const showDateHeader = key !== lastDateKey
              lastDateKey = key

              return (
                <li key={item.id}>
                  {showDateHeader && (
                    <p className="mb-1 mt-4 text-xs font-semibold text-gray-400 first:mt-0">
                      {formatDateHeader(item.startTime)}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <div className="w-14 shrink-0 text-right text-xs text-gray-500">
                      <p>{formatTime(item.startTime)}</p>
                      <p>{formatTime(item.endTime)}</p>
                    </div>
                    <div className="min-w-0 flex-1 rounded-lg border border-gray-200 p-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            TYPE_STYLE[item.type] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {TIMELINE_TYPE_LABEL[item.type] || item.type}
                        </span>
                        {item.estimated && <span className="text-[10px] text-gray-400">(예상)</span>}
                      </div>
                      <p className="mt-1 break-words text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="break-words text-xs text-gray-500">{item.location}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </>
      )}

      <div className="mt-4 space-y-2">
        <p className="tape-label text-center text-[11px]">🧳 타임라인 완성!</p>
        <p className="text-center text-[11px] text-gray-400">
          다이어리는 허브로 돌아가서 "다이어리 생성" 버튼으로 시작할 수 있어요.
        </p>

        <button
          type="button"
          onClick={onRegenerate}
          disabled={loading}
          className="w-full rounded-lg border border-[#1a1a1a] py-2.5 text-sm text-[#1a1a1a] disabled:opacity-40"
        >
          다른 일정 추천받기
        </button>
        <p className="text-center text-[11px] text-gray-400">
          선택한 관광지는 그대로 두고, 방문 순서와 휴식 배치만 다시 계산합니다.
        </p>

        <button
          type="button"
          onClick={onReselectPlaces}
          disabled={loading}
          className="w-full rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700 disabled:opacity-40"
        >
          관광지 다시 선택하기
        </button>
      </div>
    </section>
  )
}

export default TimelineResultStep
