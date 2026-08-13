import ErrorMessage from '../../components/ErrorMessage'
import LoadingIndicator from '../../components/LoadingIndicator'
import { DIARY_TONES } from '../../utils/diaryTone'

function DiaryInputStep({
  destination,
  timelineData,
  memo,
  onChangeMemo,
  tone,
  onChangeTone,
  onSubmit,
  canSubmit,
  loading,
  error,
  onBack,
}) {
  const summary = timelineData?.summary

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">📔 다이어리 만들기</h2>
      <p className="mt-1 text-sm text-gray-500">여행지: {destination}</p>

      {summary && (
        <div className="mt-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          관광지 {summary.placeCount}곳 · 관광시간 {summary.sightseeingMinutes}분 · 예상 이동시간{' '}
          {summary.estimatedTravelMinutes}분
        </div>
      )}

      <div className="mt-4">
        <p className="text-sm font-semibold text-gray-900">여행 전체 메모</p>
        <textarea
          className="mt-2 h-28 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-[#1a1a1a] focus:outline-none"
          value={memo}
          onChange={(event) => onChangeMemo(event.target.value)}
          placeholder={
            '예: 유아와 함께한 여행이라 중간중간 쉬어 갔다. 광안리에서 본 야경이 가장 기억에 남았고, ' +
            '자갈치시장에서 먹은 음식도 맛있었다.'
          }
        />
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold text-gray-900">다이어리 문체</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {DIARY_TONES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChangeTone(option.value)}
              className={`rounded-lg border p-2 text-left ${
                tone === option.value ? 'border-[#1a1a1a] bg-[#f3ece2] text-[#1a1a1a]' : 'border-gray-300 text-gray-700'
              }`}
            >
              <p className="text-xs font-semibold">{option.label}</p>
              <p className="mt-0.5 text-[10px] text-gray-500">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      <ErrorMessage message={error} />
      {!canSubmit && (
        <p className="mt-2 text-xs text-yellow-700">
          여행 전체 메모를 입력하거나, 타임라인 화면에서 사진을 1장 이상 추가해주세요.
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || !canSubmit}
        className="mt-4 w-full rounded-lg bg-[#1a1a1a] py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {loading ? '다이어리 생성 중...' : '다이어리 생성하기'}
      </button>

      {loading && <LoadingIndicator label="사진과 메모를 바탕으로 다이어리를 작성하는 중..." />}

      <button
        type="button"
        onClick={onBack}
        disabled={loading}
        className="mt-3 w-full rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700 disabled:opacity-40"
      >
        타임라인으로 돌아가기
      </button>
    </section>
  )
}

export default DiaryInputStep
