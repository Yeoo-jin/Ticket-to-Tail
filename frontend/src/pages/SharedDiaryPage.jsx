import { useEffect, useState } from 'react'
import { getSharedDiary } from '../services/shareApi'
import { resolveAssetUrl } from '../services/apiClient'

function CenteredMessage({ children }) {
  return (
    <div className="notebook-page min-h-app flex items-center justify-center px-6">
      <p className="text-center text-sm text-[#6b6459]">{children}</p>
    </div>
  )
}

// 카카오톡 등으로 공유된 링크로 들어왔을 때 보여주는 읽기 전용 다이어리 화면.
// 편집 중 화면의 배경/패턴/글자 스타일 등은 재현하지 않고, 사진·글·해시태그 위주로 보여준다.
function SharedDiaryPage({ shareId }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })

  useEffect(() => {
    let cancelled = false
    getSharedDiary(shareId)
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
    return <CenteredMessage>공유된 다이어리를 찾을 수 없어요. ({state.error})</CenteredMessage>
  }

  const { destination, title, diary, summary, hashtags, photos } = state.data

  return (
    <div className="notebook-page min-h-app px-4 py-6">
      <div className="notebook-spine-holes" />
      <div className="mx-auto w-full max-w-md pl-6">
        <p className="text-xs text-[#8a7c6f]">공유된 여행 다이어리 · {destination}</p>
        <h1 className="mt-1 text-xl font-bold text-[#2c2420]">{title}</h1>

        <div className="note-card-taped mt-4 space-y-4 p-4 sm:p-6">
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {photos.map((photo, index) => (
                <figure key={photo.url} className="overflow-hidden rounded-lg border border-gray-200">
                  <img src={resolveAssetUrl(photo.url)} alt={photo.caption || `사진 ${index + 1}`} className="h-32 w-full object-cover" />
                  {photo.caption && <figcaption className="p-1.5 text-center text-[11px] text-gray-500">{photo.caption}</figcaption>}
                </figure>
              ))}
            </div>
          )}

          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">{diary}</p>

          {summary && <p className="break-words text-xs text-gray-500">{summary}</p>}

          {hashtags.length > 0 && (
            <p className="break-words text-xs text-blue-700">{hashtags.join(' ')}</p>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-[#a39c92]">Ticket to Tale로 만든 여행 다이어리예요.</p>
      </div>
    </div>
  )
}

export default SharedDiaryPage
