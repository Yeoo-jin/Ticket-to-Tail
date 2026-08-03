// 폴라로이드 아래 글귀(사진별 caption) 수정 UI. 초깃값은 photoMemo이며,
// 수정하면 board·PNG에 즉시 반영된다. 2줄 제한과 말줄임표 처리는 표시 단계(board)에서 한다.
function PhotoCaptionEditor({ photos, captions, onChangeCaption }) {
  if (!photos || photos.length === 0) return null

  return (
    <details className="rounded-lg border border-gray-200 p-3" open>
      <summary className="cursor-pointer text-sm font-semibold text-gray-900">사진 아래 글귀 수정</summary>
      <div className="mt-3 space-y-2">
        {photos.map((photo, index) => (
          <div key={photo.previewUrl} className="flex gap-2">
            <img src={photo.previewUrl} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
            <textarea
              value={captions[index] ?? ''}
              onChange={(event) => onChangeCaption(index, event.target.value)}
              placeholder="이 사진 아래에 표시할 짧은 글귀 (선택)"
              rows={2}
              className="flex-1 resize-none rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
        ))}
      </div>
    </details>
  )
}

export default PhotoCaptionEditor
