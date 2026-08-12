import ErrorMessage from '../../components/ErrorMessage'
import LoadingIndicator from '../../components/LoadingIndicator'
import ShareButton from '../../components/ShareButton'
import TripMap from '../../components/TripMap'
import { createTimelineShare } from '../../services/shareApi'
import { companionTypeLabels } from '../../utils/companionTypes'
import { TIMELINE_TYPE_LABEL, dateKey, formatDateHeader, formatTime } from '../../utils/timelineDisplay'

const TYPE_STYLE = {
  arrival: 'bg-sky-100 text-sky-700',
  transport: 'bg-gray-100 text-gray-600',
  attraction: 'bg-blue-100 text-blue-700',
  meal: 'bg-orange-100 text-orange-700',
  rest: 'bg-green-100 text-green-700',
  departure: 'bg-sky-100 text-sky-700',
}

function TimelineResultStep({
  timelineData,
  destination,
  onRegenerate,
  onReselectPlaces,
  loading,
  error,
  placeCoordinates,
}) {
  const timeline = timelineData?.timeline ?? []
  const summary = timelineData?.summary
  const warnings = timelineData?.warnings ?? []

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
          <p>관광시간 {summary.sightseeingMinutes}분</p>
          <p>예상 이동시간 {summary.estimatedTravelMinutes}분</p>
          <p>
            {companionTypeLabels(summary.companionTypes).join(' · ')} ·{' '}
            {summary.pace === 'relaxed' ? '여유롭게' : '보통'}
          </p>
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
