import ErrorMessage from '../../components/ErrorMessage'
import { MAX_PHOTOS } from '../../utils/photoUpload'
import { TIMELINE_TYPE_LABEL, formatTime } from '../../utils/timelineDisplay'

// 관광지·식사 항목에만 사진을 붙일 수 있게 한다(이동·휴식 등은 "찍을 만한 순간"이 아니라서 제외).
const PHOTO_ATTACHABLE_TYPES = new Set(['attraction', 'meal'])

function TimelineItemPhotos({ item, photos, onAddPhotos, onRemovePhoto, onChangePhotoMemo }) {
  const itemPhotos = photos
    .map((photo, index) => ({ photo, index }))
    .filter(({ photo }) => photo.timelineItemId === item.id)
  const disabled = photos.length >= MAX_PHOTOS

  return (
    <div className="mt-2 border-t border-dashed border-gray-200 pt-2">
      {itemPhotos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {itemPhotos.map(({ photo, index }) => (
            <li key={photo.previewUrl} className="w-24">
              <img
                src={photo.previewUrl}
                alt={`${item.title} 사진`}
                className="h-16 w-24 rounded-md object-cover"
              />
              <input
                type="text"
                value={photo.memo}
                onChange={(event) => onChangePhotoMemo(index, event.target.value)}
                placeholder="사진 메모(선택)"
                className="mt-1 w-full rounded border border-gray-200 px-1.5 py-0.5 text-[10px]"
              />
              <button
                type="button"
                onClick={() => onRemovePhoto(index)}
                className="mt-0.5 text-[10px] text-red-500"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      <label
        className={`mt-1.5 inline-block text-[11px] underline ${
          disabled ? 'cursor-not-allowed text-gray-300' : 'cursor-pointer text-gray-500'
        }`}
      >
        📷 사진 추가
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled}
          className="hidden"
          onChange={(event) => {
            onAddPhotos(Array.from(event.target.files || []), item.id)
            event.target.value = ''
          }}
        />
      </label>
    </div>
  )
}

function DiaryPhotoInputStep({
  dayLabel,
  dayItems,
  isFirstDay,
  isLastDay,
  photos,
  photoError,
  onAddPhotos,
  onRemovePhoto,
  onChangePhotoMemo,
  onNext,
  onBack,
}) {
  const attachableItems = dayItems.filter((item) => PHOTO_ATTACHABLE_TYPES.has(item.type))

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">📸 {dayLabel} 사진·메모</h2>
      <p className="mt-1 text-sm text-gray-500">이날 방문한 관광지·식사에 사진과 메모를 붙여주세요. (선택)</p>

      <ErrorMessage message={photoError} />

      {attachableItems.length === 0 ? (
        <p className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
          이날은 사진을 붙일 관광지·식사 일정이 없어요.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {attachableItems.map((item) => (
            <li key={item.id} className="rounded-lg border border-gray-200 p-3 text-sm">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>{formatTime(item.startTime)}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                  {TIMELINE_TYPE_LABEL[item.type] || item.type}
                </span>
              </div>
              <p className="mt-1 font-medium text-gray-900">{item.title}</p>
              <TimelineItemPhotos
                item={item}
                photos={photos || []}
                onAddPhotos={onAddPhotos}
                onRemovePhoto={onRemovePhoto}
                onChangePhotoMemo={onChangePhotoMemo}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700"
        >
          {isFirstDay ? '타임라인으로' : '이전 날짜로'}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-lg bg-[#1a1a1a] py-2.5 text-sm text-white"
        >
          {isLastDay ? '다음 (메모·문체)' : '다음 날짜로'}
        </button>
      </div>
    </section>
  )
}

export default DiaryPhotoInputStep
