import { useEffect, useState } from 'react'
import TripMap from '../components/TripMap'
import DoodleSticker from '../components/stickers/DoodleSticker'
import { getSharedTimeline } from '../services/shareApi'
import { companionTypeLabels } from '../utils/companionTypes'
import { TIMELINE_TYPE_LABEL, dateKey, formatDateHeader, formatTime } from '../utils/timelineDisplay'

const TYPE_STYLE = {
  arrival: 'bg-sky-100 text-sky-700',
  transport: 'bg-gray-100 text-gray-600',
  attraction: 'bg-blue-100 text-blue-700',
  meal: 'bg-orange-100 text-orange-700',
  rest: 'bg-green-100 text-green-700',
  departure: 'bg-sky-100 text-sky-700',
  accommodation: 'bg-purple-100 text-purple-700',
}

function CenteredMessage({ children }) {
  return (
    <div className="notebook-page min-h-app flex items-center justify-center px-6">
      <p className="text-center text-sm text-[#6b6459]">{children}</p>
    </div>
  )
}

// 카카오톡 등으로 공유된 링크로 들어왔을 때 보여주는 읽기 전용 화면. 로그인이나 이번 세션
// 상태(placesByDay 등) 없이, 서버에 저장된 공유 데이터만으로 동작한다.
function SharedTimelinePage({ shareId }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })

  useEffect(() => {
    let cancelled = false
    getSharedTimeline(shareId)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: '' })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', data: null, error: error.message })
      })
    return () => {
      cancelled = true
    }
  }, [shareId])

  if (state.status === 'loading') return <CenteredMessage>불러오는 중...</CenteredMessage>
  if (state.status === 'error') {
    return <CenteredMessage>공유된 타임라인을 찾을 수 없어요. ({state.error})</CenteredMessage>
  }

  const { destination, timeline, summary } = state.data
  let lastDateKey = null

  return (
    <div className="notebook-page min-h-app px-4 py-6">
      <div className="notebook-spine-holes" />
      <DoodleSticker
        icon="map"
        className="pointer-events-none absolute z-10 right-1 top-1 h-9 w-9 rotate-6 text-[#a38a6a] opacity-55"
      />
      <DoodleSticker
        icon="hotAirBalloon"
        className="pointer-events-none absolute z-10 left-1 top-1 h-8 w-8 -rotate-3 text-[#a38a6a] opacity-55"
      />
      <DoodleSticker
        icon="suitcase"
        className="pointer-events-none absolute z-10 bottom-3 left-8 h-10 w-10 -rotate-6 text-[#a38a6a] opacity-55"
      />
      <div className="mx-auto w-full max-w-md pl-6">
        <p className="text-xs text-[#8a7c6f]">공유된 여행 타임라인</p>
        <h1 className="mt-1 text-xl font-bold text-[#2c2420]">{destination}</h1>

        <div className="note-card-taped mt-4 p-4 sm:p-6">
          {summary && (
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <p>관광지 {summary.placeCount}곳</p>
              <p>관광시간 {summary.sightseeingMinutes}분</p>
              <p>예상 이동시간 {summary.estimatedTravelMinutes}분</p>
              <p>
                {companionTypeLabels(summary.companionTypes).join(' · ')} ·{' '}
                {summary.pace === 'relaxed' ? '여유롭게' : '보통'}
              </p>
            </div>
          )}

          {timeline.length > 0 && (
            <div className="mt-3">
              <TripMap timeline={timeline} />
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
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${TYPE_STYLE[item.type] || 'bg-gray-100 text-gray-600'}`}
                      >
                        {TIMELINE_TYPE_LABEL[item.type] || item.type}
                      </span>
                      <p className="mt-1 break-words text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="break-words text-xs text-gray-500">{item.location}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}

export default SharedTimelinePage
