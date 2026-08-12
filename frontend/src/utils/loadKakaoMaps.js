let kakaoMapsPromise = null

// 카카오맵 JS SDK를 한 번만 동적으로 불러온다. 여러 컴포넌트에서 동시에 호출해도
// script 태그는 하나만 추가되고, 전부 같은 Promise를 공유한다.
export function loadKakaoMaps() {
  if (kakaoMapsPromise) return kakaoMapsPromise

  kakaoMapsPromise = new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      resolve(window.kakao)
      return
    }

    const appKey = import.meta.env.VITE_KAKAO_JS_KEY
    if (!appKey) {
      kakaoMapsPromise = null
      reject(new Error('카카오맵 API 키(VITE_KAKAO_JS_KEY)가 설정되지 않았습니다.'))
      return
    }

    const script = document.createElement('script')
    // libraries=services: 자율 관광지 입력에서 쓰는 장소 검색(kakao.maps.services.Places)에 필요하다.
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`
    script.async = true
    script.onload = () => {
      window.kakao.maps.load(() => resolve(window.kakao))
    }
    script.onerror = () => {
      kakaoMapsPromise = null
      reject(new Error('카카오맵 SDK를 불러오지 못했습니다.'))
    }
    document.head.appendChild(script)
  })

  return kakaoMapsPromise
}
