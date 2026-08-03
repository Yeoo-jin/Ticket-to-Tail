import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// server.proxy는 개발 환경에서 항상 적용되고 프로덕션 빌드 결과물에는 포함되지 않는다.
// frontend가 상대 경로(/api, /health)로 보낸 요청을 backend(127.0.0.1:8000)로 전달해주므로,
// 브라우저는 항상 frontend 자신과 같은 origin(예: iPhone에서 접속한 PC의 LAN 주소)으로만
// 요청을 보내면 되고, 코드에 localhost/127.0.0.1을 하드코딩할 필요가 없다.
// host/port는 여기서 고정하지 않는다 - 기본 `npm run dev`는 기존처럼 localhost로 열리고,
// LAN(iPhone 등)에 열어야 할 때만 `npm run dev:lan`으로 --host 0.0.0.0을 명시적으로 켠다.
// allowedHosts는 설정하지 않는다 - IP 주소 접속은 Vite 기본 정책으로 이미 허용된다.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
})
