import { useState } from 'react'

function TripRow({ trip }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="trip-card relative px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1a1a1a]">{trip.title || '제목 없는 여행'}</p>
          <p className="mt-0.5 text-[11px] text-[#a39c92]">
            {trip.timelineDone ? '타임라인 완료' : '타임라인 준비 중'}
            {trip.diaryDone ? ' · 다이어리 완료' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="kebab-btn"
          aria-label="공유 메뉴 열기"
        >
          ⋮
        </button>
      </div>

      {menuOpen && (
        <div className="kebab-menu">
          <button
            type="button"
            className="kebab-menu-item"
            disabled={!trip.timelineDone}
            onClick={() => setMenuOpen(false)}
          >
            타임라인 공유
          </button>
          <button
            type="button"
            className="kebab-menu-item"
            disabled={!trip.diaryDone}
            onClick={() => setMenuOpen(false)}
          >
            다이어리 공유
          </button>
        </div>
      )}
    </div>
  )
}

function MyPage({ trips, onBack }) {
  return (
    <div className="notebook-page min-h-app relative px-6 py-10">
      <div className="notebook-spine-holes" />

      <div className="mx-auto w-full max-w-xs pl-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#2c2420]">마이페이지</h1>
          <button type="button" onClick={onBack} className="mypage-back-tab px-3 py-1.5 text-xs">
            ← 허브로
          </button>
        </div>
        <p className="mt-1 text-xs text-[#8a7c6f]">지금까지 만든 여행 기록이에요</p>

        <div className="mt-6 flex flex-col gap-3">
          {trips.length === 0 && <p className="text-sm text-[#a39c92]">아직 만든 여행이 없어요.</p>}
          {trips.map((trip) => (
            <TripRow key={trip.id} trip={trip} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default MyPage
