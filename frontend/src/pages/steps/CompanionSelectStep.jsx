import ErrorMessage from '../../components/ErrorMessage'
import { COMPANION_TYPES } from '../../utils/companionTypes'

function CompanionSelectStep({
  destination,
  onChangeDestination,
  selectedCompanionTypes,
  onToggleCompanionType,
  onSubmit,
  loading,
  error,
  onBack,
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">3. 동행 조건 선택</h2>
      <p className="mt-1 text-sm text-gray-500">함께 여행하는 동행자의 특성을 선택해주세요. (복수 선택 가능)</p>

      <label className="mt-3 block text-sm text-gray-700">
        여행 목적지
        <input
          className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
          value={destination}
          onChange={(event) => onChangeDestination(event.target.value)}
          placeholder="예: 부산"
        />
      </label>
      <p className="mt-1 text-xs text-gray-400">
        예매정보에서 자동으로 추정한 값이에요. 실제 목적지와 다르면 직접 수정해주세요.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {COMPANION_TYPES.map((type) => {
          const active = selectedCompanionTypes.includes(type.value)
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onToggleCompanionType(type.value)}
              className={`rounded-lg border px-3 py-2 text-sm ${
                active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
              }`}
            >
              {type.label}
            </button>
          )
        })}
      </div>

      <ErrorMessage message={error} />

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !destination.trim() || selectedCompanionTypes.length === 0}
          className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm text-white disabled:opacity-40"
        >
          {loading ? '추천받는 중...' : '관광지 추천받기'}
        </button>
      </div>
    </section>
  )
}

export default CompanionSelectStep
