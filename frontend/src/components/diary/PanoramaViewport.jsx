import { BOARD_HEIGHT, BOARD_WIDTH, SEGMENT_WIDTH } from '../../utils/panoramaLayouts'

// 하나의 master board(3240×1350)를 세 구간으로 "잘라" 보여주는 창(viewport) 하나.
// 같은 boardContent를 여러 PanoramaViewport에 그대로 넘기면, 각 인스턴스는 자신의
// segmentIndex(0/1/2)만큼 board를 왼쪽으로 이동시켜 보여주므로 항상 같은 자료로부터
// 잘려나온 조각이 된다(독립적으로 다시 그려서 맞추는 방식이 아님).
//
// displayScale=1이면 실제 1080×1350 네이티브 크기(내보내기용), 1보다 작으면 화면 미리보기용
// 축소 크기가 된다. viewportRef는 PNG 저장 시 캡처할 DOM 노드를 얻기 위해 사용한다.
function PanoramaViewport({ segmentIndex, children, displayScale = 1, viewportRef, className = '' }) {
  const displayWidth = SEGMENT_WIDTH * displayScale
  const displayHeight = BOARD_HEIGHT * displayScale

  return (
    <div
      ref={viewportRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width: displayWidth, height: displayHeight }}
    >
      <div
        style={{
          width: SEGMENT_WIDTH,
          height: BOARD_HEIGHT,
          position: 'relative',
          overflow: 'hidden',
          transform: `scale(${displayScale})`,
          transformOrigin: 'top left',
        }}
      >
        <div
          style={{
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            position: 'absolute',
            top: 0,
            left: -segmentIndex * SEGMENT_WIDTH,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export default PanoramaViewport
