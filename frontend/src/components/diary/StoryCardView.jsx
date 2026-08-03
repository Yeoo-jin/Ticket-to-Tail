import { THEME_CONFIG } from '../../utils/diaryTheme'
import { getPhotoStyle, photoImageStyle } from '../../utils/photoStyle'

function CardPhoto({ photo, style, className = '' }) {
  if (!photo) return <div className="h-full w-full bg-gray-300" />
  return (
    <img
      src={photo.previewUrl}
      alt=""
      className={`h-full w-full object-cover ${className}`}
      style={photoImageStyle(style)}
    />
  )
}

function Badges({ card, badgeClass }) {
  if (!card.locationLabel && !card.dateLabel) return null
  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5">
      {card.locationLabel && <span className={badgeClass}>{card.locationLabel}</span>}
      {card.dateLabel && <span className={badgeClass}>{card.dateLabel}</span>}
    </div>
  )
}

function AccentWords({ words, accentClass }) {
  if (!words || words.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className={accentClass}>
          {word}
        </span>
      ))}
    </div>
  )
}

function PhotoLayer({ card, photos, photoStyles }) {
  const indexes = card.photoIndexes || []
  if (indexes.length === 0) return null

  if (card.type === 'collage' && indexes.length >= 2) {
    if (card.layoutVariant === 'split-2') {
      return (
        <div className="grid h-full grid-cols-2 gap-0.5">
          <CardPhoto photo={photos[indexes[0]]} style={getPhotoStyle(photoStyles, indexes[0])} />
          <CardPhoto photo={photos[indexes[1]]} style={getPhotoStyle(photoStyles, indexes[1])} />
        </div>
      )
    }
    const rest = indexes.slice(1, 3)
    return (
      <div className="grid h-full grid-rows-[62%_38%] gap-0.5">
        <CardPhoto photo={photos[indexes[0]]} style={getPhotoStyle(photoStyles, indexes[0])} />
        <div className={`grid gap-0.5 ${rest.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {rest.map((idx) => (
            <CardPhoto key={idx} photo={photos[idx]} style={getPhotoStyle(photoStyles, idx)} />
          ))}
        </div>
      </div>
    )
  }

  return <CardPhoto photo={photos[indexes[0]]} style={getPhotoStyle(photoStyles, indexes[0])} />
}

// SNS 캐러셀·블로그 스토리가 공유하는 카드 렌더러. theme에 따라 배경·폰트·배지·스티커만
// 바꿔 그리고, 카드 타입(cover/single_photo/collage/quote/ending)에 따라 레이아웃을 바꾼다.
function StoryCardView({ card, photos, photoStyles, theme, cardRef }) {
  const config = THEME_CONFIG[theme] || THEME_CONFIG.film
  const hasPhoto = Boolean(card.photoIndexes && card.photoIndexes.length > 0)
  const isTextOnly = card.type === 'quote' || card.type === 'ending' || !hasPhoto
  const frameClass = card.type === 'collage' ? '' : config.photoFrame

  return (
    <div
      ref={cardRef}
      className={`relative aspect-[4/5] w-full overflow-hidden ${config.cardBg} ${config.cardBorder} ${config.cardShadow} ${config.photoRound}`}
    >
      {theme === 'scrapbook' && <div className="dt-washi-tape" />}

      {isTextOnly ? (
        <div className={`flex h-full w-full flex-col items-center justify-center p-6 text-center ${config.textOnlyBg}`}>
          {card.type === 'quote' && <span className="mb-1 text-5xl leading-none opacity-25">&ldquo;</span>}
          <Badges card={card} badgeClass={config.badge} />
          <p className={`text-base font-semibold leading-snug break-words ${config.headlineFont}`}>{card.headline}</p>
          {card.body && <p className={`mt-2 text-sm leading-relaxed break-words ${config.bodyFont}`}>{card.body}</p>}
          <AccentWords words={card.accentWords} accentClass={config.accent} />
        </div>
      ) : (
        <div className={`relative h-full w-full ${frameClass}`}>
          <PhotoLayer card={card} photos={photos} photoStyles={photoStyles} />
          <div className={`absolute inset-x-0 bottom-0 p-4 ${config.scrim}`}>
            <Badges card={card} badgeClass={config.badge} />
            <p className="break-words text-lg font-semibold leading-snug text-white">{card.headline}</p>
            {card.body && <p className="mt-1 break-words text-xs leading-relaxed text-white/90">{card.body}</p>}
            {card.caption && <p className="mt-1 break-words text-[11px] italic text-white/80">{card.caption}</p>}
            <AccentWords words={card.accentWords} accentClass={config.accent} />
          </div>
        </div>
      )}
    </div>
  )
}

export default StoryCardView
