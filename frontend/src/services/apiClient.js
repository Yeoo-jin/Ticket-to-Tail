const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

async function handleResponse(response) {
  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload || payload.success === false) {
    const message = payload?.error?.message || `요청이 실패했습니다. (HTTP ${response.status})`
    const error = new Error(message)
    error.code = payload?.error?.code || 'UNKNOWN_ERROR'
    throw error
  }

  return payload.data
}

export async function postJson(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(response)
}

// multipart/form-data 요청. Content-Type은 브라우저가 boundary를 포함해 자동으로 설정하므로 직접 지정하지 않는다.
export async function postFormData(path, formData) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
  })
  return handleResponse(response)
}
