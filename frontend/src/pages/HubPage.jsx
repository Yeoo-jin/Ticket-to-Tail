import ShareButton from '../components/ShareButton'

function HubPage({ title, timelineDone, diaryDone, onGenerateTimeline, onGenerateDiary, onOpenMyPage }) {
  return (
    <div className="notebook-page min-h-app relative px-6 py-10">
      <div className="notebook-spine-holes" />

      <div className="mx-auto flex w-full max-w-xs flex-col pl-6">
        <p className="text-xs text-[#8a7c6f]">우리들의 여행</p>
        <h1 className="mt-1 text-xl font-bold text-[#2c2420]">{title}</h1>

        <div className="washi-card mt-10 flex flex-col items-center gap-3 px-5 py-7 text-center">
          <div className="washi-tape" />
          <span className="text-3xl">🧳</span>
          <h2 className="text-base font-semibold text-[#1a1a1a]">타임라인 생성</h2>
          <p className="text-xs text-[#6b6459]">예매정보와 관광지를 바탕으로 여행 일정을 만들어요</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onGenerateTimeline}
              className="rounded-full bg-[#1a1a1a] px-5 py-2 text-sm text-white"
            >
              {timelineDone ? '타임라인 보기' : '타임라인 생성'}
            </button>
            <ShareButton label="공유" disabled={!timelineDone} />
          </div>
        </div>

        <div className="washi-card mt-6 flex flex-col items-center gap-3 px-5 py-7 text-center">
          <div className="washi-tape" />
          <span className="text-3xl">📔</span>
          <h2 className="text-base font-semibold text-[#1a1a1a]">다이어리 생성</h2>
          <p className="text-xs text-[#6b6459]">
            {timelineDone ? '사진과 메모로 여행 다이어리를 만들어요' : '타임라인을 먼저 만들어주세요'}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onGenerateDiary}
              disabled={!timelineDone}
              className="rounded-full bg-[#1a1a1a] px-5 py-2 text-sm text-white disabled:opacity-30"
            >
              {diaryDone ? '다이어리 보기' : '다이어리 생성'}
            </button>
            <ShareButton label="공유" disabled={!diaryDone} />
          </div>
        </div>
      </div>

      <button type="button" onClick={onOpenMyPage} className="hub-tab px-4 py-2 text-sm">
        마이페이지
      </button>
    </div>
  )
}

export default HubPage
