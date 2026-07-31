import ErrorMessage from '../../components/ErrorMessage'
import LoadingIndicator from '../../components/LoadingIndicator'

function BookingInputStep({ bookingText, onChangeText, onSubmit, loading, error }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">1. 예매정보 입력</h2>
      <p className="mt-1 text-sm text-gray-500">항공·철도 예매정보를 자유롭게 입력해주세요.</p>

      <textarea
        className="mt-3 h-40 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
        placeholder={
          '예: 2026년 8월 12일 오전 10시 30분 인천공항 도착. ' +
          '오후 1시 20분 서울역에서 KTX 출발, 오후 4시 5분 부산역 도착. 8월 14일 오후 6시 인천공항 출발.'
        }
        value={bookingText}
        onChange={(event) => onChangeText(event.target.value)}
        disabled={loading}
      />

      <ErrorMessage message={error} />

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || !bookingText.trim()}
        className="mt-3 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {loading ? '분석 중...' : '예매정보 분석하기'}
      </button>

      {loading && <LoadingIndicator label="AI가 예매정보를 분석하고 있어요..." />}
    </section>
  )
}

export default BookingInputStep
