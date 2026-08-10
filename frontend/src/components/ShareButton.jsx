import { useState } from 'react'

// 공유 버튼 UI. 실제 공유(링크 발급)는 아직 연결되지 않아, 누르면 준비 중 안내만 짧게 보여준다.
function ShareButton({ label = '공유', className = '', disabled = false }) {
  const [showToast, setShowToast] = useState(false)

  function handleClick() {
    setShowToast(true)
    setTimeout(() => setShowToast(false), 1800)
  }

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`rounded-full border border-[#1a1a1a] px-3 py-1 text-xs text-[#1a1a1a] disabled:opacity-30 ${className}`}
      >
        {label}
      </button>
      {showToast && <span className="share-toast absolute top-full mt-1 whitespace-nowrap">공유 기능은 준비 중이에요 🔧</span>}
    </div>
  )
}

export default ShareButton
