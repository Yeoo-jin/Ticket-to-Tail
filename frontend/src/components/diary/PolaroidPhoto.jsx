import { photoImageStyle } from '../../utils/photoStyle'

// master board 절대 좌표(x, y, width, height)에 폴라로이드 한 장을 배치한다.
// 위·좌·우 여백(framePad)은 동일하게, 아래 여백은 그 약 2.5배로 두어(요구사항) 실제
// 폴라로이드처럼 보이게 하고, 그 아래 여백 안에 사진별 글귀(최대 2줄)를 표시한다.
// 사진이 없는 슬롯은 아무것도 그리지 않는다(빈 프레임을 최종 결과에 보여주지 않음).
function PolaroidPhoto({
  x,
  y,
  width,
  height,
  photoH,
  framePad,
  rotation,
  tape,
  photo,
  photoStyle,
  caption,
  fontFamily,
  captionFontSize,
}) {
  if (!photo) return null

  const bottomPad = height - photoH - framePad

  return (
    <div
      className="pb-polaroid"
      style={{
        left: x,
        top: y,
        width,
        height,
        padding: `${framePad}px ${framePad}px ${bottomPad}px`,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      {tape && tape !== 'none' && <div className={`pb-tape pb-tape-${tape}`} />}
      <div className="pb-polaroid-photo" style={{ height: photoH }}>
        <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" style={photoImageStyle(photoStyle)} />
      </div>
      {caption && (
        <p
          className="pb-polaroid-caption"
          style={{ marginTop: framePad * 0.25, fontSize: captionFontSize, fontFamily }}
        >
          {caption}
        </p>
      )}
    </div>
  )
}

export default PolaroidPhoto
