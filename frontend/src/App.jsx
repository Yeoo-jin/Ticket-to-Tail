import { useEffect, useState } from 'react'
import { checkHealth } from './services/healthApi'

function App() {
  const [status, setStatus] = useState('checking')
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    checkHealth()
      .then((data) => {
        setStatus('connected')
        setDetail(data)
      })
      .catch((error) => {
        setStatus('failed')
        setDetail({ message: error.message })
      })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Ticket to Tale</h1>
        <p className="mt-1 text-sm text-gray-500">프론트엔드 실행 확인용 임시 화면</p>

        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
          <p>
            백엔드 연결 상태:{' '}
            {status === 'checking' && <span className="text-gray-500">확인 중...</span>}
            {status === 'connected' && <span className="font-medium text-green-600">연결됨</span>}
            {status === 'failed' && <span className="font-medium text-red-600">연결 실패</span>}
          </p>
          {detail && (
            <pre className="mt-2 overflow-x-auto text-left text-xs text-gray-600">
              {JSON.stringify(detail, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
