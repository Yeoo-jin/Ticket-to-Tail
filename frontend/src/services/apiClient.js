const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export async function postJson(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload || payload.success === false) {
    const message = payload?.error?.message || `요청이 실패했습니다. (HTTP ${response.status})`
    const error = new Error(message)
    error.code = payload?.error?.code || 'UNKNOWN_ERROR'
    throw error
  }

  return payload.data
}
