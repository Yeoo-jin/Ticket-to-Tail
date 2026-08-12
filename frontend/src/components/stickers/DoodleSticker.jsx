// 여행 관련 손그림 느낌의 흑백 라인아트 스티커 아이콘 모음.
// 외부 아이콘 라이브러리 없이 직접 그린 SVG path로, 기존 마스킹테이프·삐뚤빼뚤한
// 카드 등과 톤을 맞춘 흑백 손그림 스타일만 사용한다. 장식 전용이라 aria-hidden 처리한다.
//
// airplane / suitcase / camera / map은 viewBox 0 0 64 64 기준으로 정성껏 다시 그린
// "손그림 doodle" 버전(윤곽선을 일부러 완벽한 도형이 아니게, 작은 반짝임·점선 디테일 포함).
// 나머지 아이콘은 아직 이전 단순 버전(viewBox 0 0 24 24)이라, 스타일이 확정되면 같은
// 방식으로 이어서 다시 그릴 예정.

const ICONS = {
  airplane: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M8 35c1-6 11-11 25-11s21 4 25 9c-4 4-13 8-25 8S9 37 8 35Z" />
        <path d="M16 26c-1-7 4-11 8-10l-3 11" />
        <path d="M26 34 18 50l7-2 7-13" />
        <circle cx="30" cy="30" r="1.3" fill="currentColor" />
        <circle cx="36" cy="30" r="1.3" fill="currentColor" />
        <circle cx="42" cy="30" r="1.3" fill="currentColor" />
        <path d="M2 29h6M1 34h5M2 39h6" />
        <path d="M50 13l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" fill="currentColor" />
      </>
    ),
  },
  suitcase: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M11 22c0-2 2-4 4-4h34c2 0 4 2 4 4v32c0 2-2 4-4 4H15c-2 0-4-2-4-4Z" />
        <path d="M25 18V10c0-2 2-4 5-4h4c3 0 5 2 5 4v8" />
        <path d="M11 36h42" />
        <path d="M28 32h8v9h-8Z" />
        <circle cx="19" cy="58" r="3" />
        <circle cx="45" cy="58" r="3" />
        <path d="M41 13l6 3-2 5-6-3Z" fill="currentColor" />
      </>
    ),
  },
  camera: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M7 20c0-3 2-5 5-5h9l3-5h16l3 5h9c3 0 5 2 5 5v25c0 3-2 5-5 5H12c-3 0-5-2-5-5Z" />
        <circle cx="32" cy="33" r="10" />
        <circle cx="32" cy="33" r="5.5" />
        <path d="M27 28c1-2 3-3 5-3" />
        <path d="M16 15v-6h7" />
        <path d="M48 15v-6h-7" />
        <circle cx="51" cy="12" r="1.4" fill="currentColor" />
      </>
    ),
  },
  map: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M9 11 23 6l12 5 13-5 9 4v39l-9-4-13 5-12-5-14 5V11Z" />
        <path d="M23 6v39" />
        <path d="M35 11v39" />
        <path d="M14 38c5-8 10 2 15-6s9-7 14-2" strokeDasharray="3 3" />
        <circle cx="44" cy="26" r="3.5" />
        <circle cx="44" cy="26" r="1" fill="currentColor" />
        <path d="M6 4l1.5 3.5L11 9l-3.5 1.5L6 14l-1.5-3.5L1 9l3.5-1.5Z" fill="currentColor" />
      </>
    ),
  },
  passport: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M14 6c0-2 2-4 4-4h28c2 0 4 2 4 4v52c0 2-2 4-4 4H18c-2 0-4-2-4-4Z" />
        <path d="M20 10 44 10 44 54 20 54Z" />
        <circle cx="32" cy="27" r="7" />
        <path d="M32 20c2 2 2 12 0 14" />
        <path d="M25 27h14" />
        <path d="M24 44h16" />
        <path d="M24 48h10" />
        <path d="M50 8l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" fill="currentColor" />
      </>
    ),
  },
  sunglasses: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M8 20c0-3 2-5 5-5h9c3 0 5 2 5 5v6c0 3-2 5-5 5h-9c-3 0-5-2-5-5Z" />
        <path d="M37 20c0-3 2-5 5-5h9c3 0 5 2 5 5v6c0 3-2 5-5 5h-9c-3 0-5-2-5-5Z" />
        <path d="M27 20c2-1 6-1 8 0" />
        <path d="M8 22c-3 0-6 1-7 3" />
        <path d="M56 22c3 0 6 1 7 3" />
        <path d="M13 17l3-3" />
        <path d="M42 17l3-3" />
        <path d="M28 6l1 3" />
        <path d="M22 8l2 3" />
        <path d="M38 8l-2 3" />
      </>
    ),
  },
  coffee: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M14 22c10-3 26-3 36 0l-4 26c0 3-3 5-6 5H24c-3 0-6-2-6-5Z" />
        <path d="M14 22c0-2 8-4 18-4s18 2 18 4-8 4-18 4-18-2-18-4Z" />
        <path d="M50 26c6-1 9 3 9 7s-4 8-9 7" />
        <path d="M31 25c-1-1-3-1-3 1 0 1 1 2 3 4 2-2 3-3 3-4 0-2-2-2-3-1Z" fill="currentColor" />
        <path d="M22 14c-2-2-2-4 0-6" />
        <path d="M32 12c-2-2-2-4 0-6" />
        <path d="M11 54c4 2 34 2 38 0" />
      </>
    ),
  },
  globe: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M32 6c14 0 22 12 22 26S46 58 32 58 10 44 10 32 18 6 32 6Z" />
        <path d="M10 30c8 4 36 4 44 0" />
        <path d="M32 6c8 8 8 44 0 52" />
        <path d="M18 12c10 12 18 28 8 44" />
        <circle cx="26" cy="24" r="1.2" fill="currentColor" />
        <circle cx="40" cy="36" r="1.2" fill="currentColor" />
      </>
    ),
  },
  compass: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M32 6c14 0 24 10 24 24S46 54 32 54 8 44 8 30 18 6 32 6Z" />
        <path d="M32 14c10 0 17 7 17 16s-7 16-17 16-17-7-17-16 7-16 17-16Z" />
        <path d="M32 20 27 32 32 40Z" fill="currentColor" />
        <path d="M32 20 37 32 32 40Z" />
        <path d="M32 8v4" />
        <path d="M32 50v4" />
        <path d="M10 30h4" />
        <path d="M50 30h4" />
      </>
    ),
  },
  pin: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M32 6c10 0 18 8 18 18 0 14-18 34-18 34S14 38 14 24c0-10 8-18 18-18Z" />
        <circle cx="32" cy="24" r="7" />
        <path d="M20 58c4-3 20-3 24 0" strokeDasharray="3 3" />
        <path d="M46 8l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" fill="currentColor" />
      </>
    ),
  },
  palmIsland: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M6 50c8-6 44-6 52 0-4 3-48 3-52 0Z" />
        <path d="M30 50c-2-14 0-24 6-32" />
        <path d="M36 18c-8-4-16-2-18 4" />
        <path d="M36 18c8-4 16-2 18 4" />
        <path d="M36 18c-6-8-14-10-18-6" />
        <path d="M36 18c6-8 14-10 18-6" />
        <circle cx="34" cy="20" r="1.5" fill="currentColor" />
        <circle cx="37" cy="22" r="1.5" fill="currentColor" />
        <path d="M2 54h4" />
        <path d="M52 54h4" />
        <path d="M8 58h4" />
        <path d="M44 58h4" />
      </>
    ),
  },
  tent: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M8 54C14 40 24 20 32 10c8 10 18 30 24 44-6 3-42 3-48 0Z" />
        <path d="M32 22 26 54" />
        <path d="M32 22 20 50" />
        <path d="M8 54 2 58" />
        <path d="M56 54 62 58" />
        <path d="M50 44v10" />
        <path d="M50 34l-5 8h10Z" />
        <path d="M50 26l-4 6h8Z" />
      </>
    ),
  },
  hotAirBalloon: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M32 4c12 0 20 10 20 20 0 8-6 14-8 18H20c-2-4-8-10-8-18C12 14 20 4 32 4Z" />
        <path d="M22 8c-2 10-2 22 2 34" />
        <path d="M32 5v37" />
        <path d="M42 8c2 10 2 22-2 34" />
        <path d="M24 46 22 58h20l-2-12Z" />
        <path d="M22 42 24 46" />
        <path d="M42 42 40 46" />
        <path d="M6 14c-2-3 1-6 4-5 0-3 5-4 6-1 2-2 5 0 4 3 2 1 1 4-1 4H8c-2 0-3-1-2-1Z" />
      </>
    ),
  },
  iceCream: {
    viewBox: '0 0 64 64',
    strokeWidth: 3.2,
    content: (
      <>
        <path d="M18 34c0-8 6-14 14-14s14 6 14 14c0 4-3 6-6 6H24c-3 0-6-2-6-6Z" />
        <path d="M22 22c0-6 4-10 10-10s10 4 10 10c0 3-2 5-5 5H27c-3 0-5-2-5-5Z" />
        <path d="M20 40 32 60 44 40Z" />
        <path d="M24 44h16" />
        <path d="M26 50h12" />
        <circle cx="32" cy="9" r="3" fill="currentColor" />
        <path d="M32 6c1-2 3-3 4-2" />
        <circle cx="16" cy="44" r="1.3" fill="currentColor" />
        <circle cx="48" cy="46" r="1.3" fill="currentColor" />
      </>
    ),
  },
}

// icon: ICONS의 키 중 하나. className으로 위치·크기·회전·색·투명도를 지정한다.
// 장식 전용이라 항상 pointer-events-none을 함께 주는 걸 권장한다.
function DoodleSticker({ icon, className = '' }) {
  const entry = ICONS[icon]
  if (!entry) return null

  return (
    <svg
      viewBox={entry.viewBox || '0 0 24 24'}
      fill="none"
      stroke="currentColor"
      strokeWidth={entry.strokeWidth || 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {entry.content}
    </svg>
  )
}

export default DoodleSticker
