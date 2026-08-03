import { useEffect, useState } from 'react'

// HTTP(비보안 컨텍스트)나 navigator.share 미지원 환경을 위한 대체 저장 경로.
// window.open을 쓰지 않고 페이지 안에서 이미지를 크게 보여줘, 사용자가 길게 눌러 저장하거나
// Safari 자체 공유 버튼을 쓸 수 있게 한다. file이 없으면 아무것도 렌더링하지 않는다.
function ImagePreviewModal({ file, onClose }) {
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!file || !previewUrl) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm text-white/90">{file.name}</p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 min-w-11 items-center justify-center rounded-full bg-white/10 px-3 text-sm text-white"
        >
          닫기
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto px-4">
        <img src={previewUrl} alt={file.name} className="max-h-full max-w-full object-contain" />
      </div>

      <p className="px-4 pb-4 text-center text-xs text-white/80">
        이미지를 길게 누르거나 Safari 공유 버튼에서 이미지 저장을 선택하세요.
      </p>
    </div>
  )
}

export default ImagePreviewModal
