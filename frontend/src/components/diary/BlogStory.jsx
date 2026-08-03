import StoryCardView from './StoryCardView'

// 블로그형 포토 스토리: 표지 → 사진 → 짧은 본문 → 콜라주 → 인용문 → 요약/해시태그 순으로
// storyCards를 세로로 이어서 보여준다. 긴 diary 본문은 기본 화면에 노출하지 않고
// 접기 영역(<details>)에 넣어 사진과 짧은 문장이 중심이 되게 한다.
function BlogStory({ cards, photos, photoStyles, theme, hashtags, diary }) {
  if (!cards || cards.length === 0) return null

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <StoryCardView key={card.id} card={card} photos={photos} photoStyles={photoStyles} theme={theme} />
      ))}

      {hashtags && hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {hashtags.map((tag) => (
            <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
              {tag}
            </span>
          ))}
        </div>
      )}

      {diary && (
        <details className="rounded-lg border border-gray-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900">전체 여행 일기 보기</summary>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{diary}</p>
        </details>
      )}
    </div>
  )
}

export default BlogStory
