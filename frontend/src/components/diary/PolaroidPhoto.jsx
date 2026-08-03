import { photoImageStyle } from '../../utils/photoStyle'

// master board 절대 좌표(x, y, width, height)에 폴라로이드 한 장을 배치한다.
// 사진이 없는 슬롯은 아무것도 그리지 않는다 - "빈 프레임을 최종 결과에 보여주지 않는다"는
// 요구사항에 따라, 사진 수가 부족할 때는 해당 슬롯 자체를 layout 단계에서 생성하지 않는다.
function PolaroidPhoto({ x, y, width, height, rotation, tape, photo, photoStyle, caption }) {
  if (!photo) return null

  return (
    <div className="pb-polaroid" style={{ left: x, top: y, width, height, transform: `rotate(${rotation}deg)` }}>
      {tape && tape !== 'none' && <div className={`pb-tape pb-tape-${tape}`} />}
      <div className="pb-polaroid-photo">
        <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" style={photoImageStyle(photoStyle)} />
      </div>
      {caption && <p className="pb-polaroid-caption">{caption}</p>}
    </div>
  )
}

export default PolaroidPhoto
