import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/panoramaDiary.css'
// 포토 다이어리 보드 전용 폰트(위치·배경·사진 글귀에만 사용, 앱 전체 UI에는 적용하지 않음).
// 보드 텍스트는 굵게 쓰지 않으므로 필요한 400 굵기만 가져와 번들 용량을 최소화한다.
import '@fontsource/noto-sans-kr/400.css'
import '@fontsource/gaegu/400.css'
import '@fontsource/noto-serif-kr/400.css'
import '@fontsource/gowun-dodum/400.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
