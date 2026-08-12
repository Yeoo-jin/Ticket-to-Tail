// 카카오 지도 SDK와는 다른 스크립트(카카오톡 공유용 일반 JS SDK)라 별도로 로드한다.
const KAKAO_SDK_VERSION = '2.8.2'

let kakaoSdkPromise = null

export function loadKakaoShare() {
  if (kakaoSdkPromise) return kakaoSdkPromise

  kakaoSdkPromise = new Promise((resolve, reject) => {
    const appKey = import.meta.env.VITE_KAKAO_JS_KEY
    if (!appKey) {
      kakaoSdkPromise = null
      reject(new Error('카카오 API 키(VITE_KAKAO_JS_KEY)가 설정되지 않았습니다.'))
      return
    }

    function initAndResolve() {
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(appKey)
      }
      resolve(window.Kakao)
    }

    if (window.Kakao) {
      initAndResolve()
      return
    }

    const script = document.createElement('script')
    script.src = `https://t1.kakaocdn.net/kakao_js_sdk/${KAKAO_SDK_VERSION}/kakao.min.js`
    script.crossOrigin = 'anonymous'
    script.onload = initAndResolve
    script.onerror = () => {
      kakaoSdkPromise = null
      reject(new Error('카카오 SDK를 불러오지 못했습니다.'))
    }
    document.head.appendChild(script)
  })

  return kakaoSdkPromise
}
