import { useState } from 'react'
import { loadKakaoShare } from '../utils/loadKakaoShare'

// 공유 버튼. onCreateShare가 없으면(아직 공유를 붙이지 않은 화면) 예전처럼 "준비 중" 안내만
// 보여주고, onCreateShare가 있으면(타임라인·다이어리 결과 화면) 실제로 공유 링크를 만들어
// 카카오톡 공유 시트를 띄운다.
//
// onCreateShare(): Promise<{ url, title, description, imageUrl? }>
// imageUrl이 있으면 카카오 feed 템플릿(사진 미리보기 포함)을, 없으면 text 템플릿을 쓴다.
function ShareButton({ label = '공유', className = '', disabled = false, onCreateShare }) {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  function flashMessage(text) {
    setMessage(text)
    setTimeout(() => setMessage(''), 2200)
  }

  async function handleClick() {
    if (status === 'loading') return

    if (!onCreateShare) {
      flashMessage('공유 기능은 준비 중이에요 🔧')
      return
    }

    setStatus('loading')
    try {
      const { url, title, description, imageUrl } = await onCreateShare()
      const kakao = await loadKakaoShare()

      if (imageUrl) {
        kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title,
            description,
            imageUrl,
            link: { mobileWebUrl: url, webUrl: url },
          },
          buttons: [{ title: '자세히 보기', link: { mobileWebUrl: url, webUrl: url } }],
        })
      } else {
        kakao.Share.sendDefault({
          objectType: 'text',
          text: `${title}\n${description}`,
          link: { mobileWebUrl: url, webUrl: url },
        })
      }
    } catch (error) {
      flashMessage(error.message)
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || status === 'loading'}
        className={`rounded-full border border-[#1a1a1a] px-3 py-1 text-xs text-[#1a1a1a] disabled:opacity-30 ${className}`}
      >
        {status === 'loading' ? '공유 준비 중...' : label}
      </button>
      {message && <span className="share-toast absolute top-full mt-1 whitespace-nowrap">{message}</span>}
    </div>
  )
}

export default ShareButton
