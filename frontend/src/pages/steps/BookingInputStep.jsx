import { useState } from 'react'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingIndicator from '../../components/LoadingIndicator'
import { MAX_PHOTOS } from '../../utils/photoUpload'

// 사진 입력이 기본이고, 텍스트 입력은 보조 수단으로 접어둔다(사진 인식이 실패하거나
// 캡처가 어려운 경우를 위한 안전망).
function BookingInputStep({ bookingText, onChangeText, onSubmitText, onSubmitPhoto, loading, error }) {
  const [mode, setMode] = useState('photo')
  // 항공권 캡처 + KTX 캡처처럼 서로 다른 예매 내역을 여러 장으로 나눠 올릴 수 있어야 해서
  // 사진 1장이 아니라 배열로 관리한다.
  const [photos, setPhotos] = useState([])

  function handlePhotoChange(event) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    setPhotos((prev) => {
      const merged = [...prev, ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]
      return merged.slice(0, MAX_PHOTOS)
    })
    event.target.value = ''
  }

  function handleRemovePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmitPhoto() {
    if (photos.length === 0) return
    onSubmitPhoto(photos.map((photo) => photo.file))
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">✈️ 예매정보 입력</h2>

      {mode === 'photo' ? (
        <>
          <p className="mt-1 text-sm text-gray-500">
            예매 내역 목록 화면을 캡처해서 올려주세요. 지금 준비 중인 여행의 예매만 보이게 캡처하면 더 정확해요.
            항공권·KTX처럼 종류가 다르면 사진을 나눠서 여러 장 올려도 돼요(최대 {MAX_PHOTOS}장).
          </p>

          {photos.length > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {photos.map((photo, index) => (
                <li key={photo.previewUrl} className="relative">
                  <img
                    src={photo.previewUrl}
                    alt={`예매 내역 캡처 ${index + 1}`}
                    className="h-24 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(index)}
                    disabled={loading}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white disabled:opacity-40"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label
            className={`mt-3 flex h-24 w-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 ${
              photos.length >= MAX_PHOTOS ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
            }`}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              disabled={loading || photos.length >= MAX_PHOTOS}
              className="hidden"
            />
            <span>📷 {photos.length > 0 ? '사진 추가' : '사진 선택 또는 촬영'}</span>
          </label>

          <ErrorMessage message={error} />

          <button
            type="button"
            onClick={handleSubmitPhoto}
            disabled={loading || photos.length === 0}
            className="mt-3 w-full rounded-lg bg-[#1a1a1a] py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {loading ? '분석 중...' : '사진으로 분석하기'}
          </button>

          <button
            type="button"
            onClick={() => setMode('text')}
            disabled={loading}
            className="mt-2 w-full text-center text-xs text-gray-400 underline disabled:opacity-40"
          >
            대신 텍스트로 직접 입력할래요
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-500">항공·철도 예매정보를 자유롭게 입력해주세요.</p>

          <textarea
            className="mt-3 h-40 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-[#1a1a1a] focus:outline-none"
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
            onClick={onSubmitText}
            disabled={loading || !bookingText.trim()}
            className="mt-3 w-full rounded-lg bg-[#1a1a1a] py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {loading ? '분석 중...' : '예매정보 분석하기'}
          </button>

          <button
            type="button"
            onClick={() => setMode('photo')}
            disabled={loading}
            className="mt-2 w-full text-center text-xs text-gray-400 underline disabled:opacity-40"
          >
            대신 사진으로 입력할래요
          </button>
        </>
      )}

      {loading && <LoadingIndicator label="AI가 예매정보를 분석하고 있어요..." />}
    </section>
  )
}

export default BookingInputStep
