import { useMemo, useState } from 'react'
import ErrorMessage from '../../components/ErrorMessage'
import LoadingIndicator from '../../components/LoadingIndicator'
import BlogStory from '../../components/diary/BlogStory'
import PhotoStyleControls from '../../components/diary/PhotoStyleControls'
import SnsCarousel from '../../components/diary/SnsCarousel'
import ThemeSwitcher from '../../components/diary/ThemeSwitcher'
import { sanitizeStoryCards } from '../../utils/storyCards'

async function copyText(text) {
  if (!navigator.clipboard) {
    throw new Error('이 브라우저에서는 자동 복사를 지원하지 않습니다. 직접 선택해 복사해주세요.')
  }
  await navigator.clipboard.writeText(text)
}

function CopyButton({ label, text }) {
  const [message, setMessage] = useState('')

  async function handleClick() {
    try {
      await copyText(text)
      setMessage('복사했어요.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-lg border border-gray-300 px-3 py-1 text-[11px] text-gray-700"
      >
        {label}
      </button>
      {message && <span className="text-[10px] text-gray-500">{message}</span>}
    </span>
  )
}

function DiaryResultStep({
  diaryData,
  photos,
  destination,
  theme,
  onChangeTheme,
  viewMode,
  onChangeViewMode,
  activeCardIndex,
  onChangeActiveCardIndex,
  photoStyles,
  onChangePhotoStyle,
  onRegenerate,
  onEditInput,
  onStartOver,
  loading,
  error,
}) {
  const storyCards = useMemo(
    () => (diaryData ? sanitizeStoryCards(diaryData.storyCards, photos.length) : []),
    [diaryData, photos.length]
  )

  if (!diaryData) {
    return (
      <section>
        <ErrorMessage message={error} />
        {loading && <LoadingIndicator label="다이어리를 생성하는 중..." />}
      </section>
    )
  }

  const { title, diary, summary, snsPost, photoCaptions, hashtags, generationMode, warnings } = diaryData
  const hashtagText = hashtags.join(' ')
  const otherWarnings = warnings.filter((warning) => !warning.includes('AI 호출에 실패'))

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">7. AI 여행 포토 다이어리</h2>

      <ErrorMessage message={error} />

      {generationMode === 'fallback' && (
        <div className="mt-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
          AI 호출에 실패해 제한적인 템플릿으로 생성된 결과입니다.
        </div>
      )}
      {otherWarnings.map((warning) => (
        <div
          key={warning}
          className="mt-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800"
        >
          {warning}
        </div>
      ))}

      {loading ? (
        <LoadingIndicator label="다이어리를 다시 생성하는 중..." />
      ) : (
        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChangeViewMode('carousel')}
              className={`rounded-lg py-2 text-sm font-medium ${
                viewMode === 'carousel' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700'
              }`}
            >
              SNS 캐러셀 보기
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('blog')}
              className={`rounded-lg py-2 text-sm font-medium ${
                viewMode === 'blog' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700'
              }`}
            >
              블로그 보기
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-gray-500">테마</p>
            <ThemeSwitcher theme={theme} onChangeTheme={onChangeTheme} />
          </div>

          <PhotoStyleControls photos={photos} photoStyles={photoStyles} onChangeStyle={onChangePhotoStyle} />

          {viewMode === 'carousel' ? (
            <SnsCarousel
              cards={storyCards}
              photos={photos}
              photoStyles={photoStyles}
              theme={theme}
              destination={destination}
              activeIndex={activeCardIndex}
              onChangeActiveIndex={onChangeActiveCardIndex}
            />
          ) : (
            <BlogStory cards={storyCards} photos={photos} photoStyles={photoStyles} theme={theme} hashtags={hashtags} diary={diary} />
          )}

          <details className="rounded-lg border border-gray-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-900">텍스트 보기 및 복사</summary>
            <div className="mt-3 space-y-4">
              <p className="break-words text-base font-semibold text-gray-900">{title}</p>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-500">여행 일기</p>
                  <CopyButton label="일기 복사" text={diary} />
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">{diary}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500">짧은 요약</p>
                <p className="mt-1 break-words text-sm text-gray-800">{summary}</p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-500">SNS 게시글</p>
                  <CopyButton label="SNS 글 복사" text={snsPost} />
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">{snsPost}</p>
              </div>

              {photoCaptions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500">사진별 캡션</p>
                  <ul className="mt-1 space-y-1 text-sm text-gray-800">
                    {photoCaptions.map((item) => (
                      <li key={item.photoIndex} className="break-words">
                        사진 {item.photoIndex + 1}: {item.caption}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-500">해시태그</p>
                  <CopyButton label="해시태그 복사" text={hashtagText} />
                </div>
                <p className="mt-1 break-words text-sm text-blue-700">{hashtagText}</p>
              </div>
            </div>
          </details>
        </div>
      )}

      <div className="mt-5 space-y-2">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={loading}
          className="w-full rounded-lg border border-blue-300 py-2.5 text-sm text-blue-700 disabled:opacity-40"
        >
          같은 정보로 다시 생성
        </button>
        <button
          type="button"
          onClick={onEditInput}
          disabled={loading}
          className="w-full rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700 disabled:opacity-40"
        >
          사진·메모 수정하기
        </button>
        <button
          type="button"
          onClick={onStartOver}
          disabled={loading}
          className="w-full rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700 disabled:opacity-40"
        >
          처음부터 다시 시작
        </button>
      </div>
    </section>
  )
}

export default DiaryResultStep
