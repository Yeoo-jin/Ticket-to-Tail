import { useEffect, useRef, useState } from 'react'
import { loadKakaoMaps } from '../utils/loadKakaoMaps'

// 추천 후보 대신 사용자가 직접 장소를 추가할 때, 이름만 받는 대신 카카오 장소검색으로
// 실제 장소를 찾아 좌표까지 함께 저장한다 - 그래야 다른 장소와의 이동시간도 거리 기반으로
// 계산되고 지도에도 표시된다. onAdd({ name, address, lat, lng })로 호출한다.
function CustomPlaceInput({ placeholder = '장소 이름으로 검색하세요', onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [sdkError, setSdkError] = useState('')
  const placesServiceRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadKakaoMaps()
      .then((kakao) => {
        if (!cancelled) placesServiceRef.current = new kakao.maps.services.Places()
      })
      .catch((error) => {
        if (!cancelled) setSdkError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || !placesServiceRef.current) {
      setResults([])
      return undefined
    }

    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      placesServiceRef.current.keywordSearch(trimmed, (data, status) => {
        if (cancelled) return
        setLoading(false)
        setResults(status === window.kakao.maps.services.Status.OK ? data.slice(0, 5) : [])
      })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  function handlePick(place) {
    onAdd({
      name: place.place_name,
      address: place.road_address_name || place.address_name || null,
      lat: Number(place.y),
      lng: Number(place.x),
    })
    setQuery('')
    setResults([])
  }

  function handleAddAsTyped() {
    const trimmed = query.trim()
    if (!trimmed) return
    onAdd({ name: trimmed, address: null, lat: null, lng: null })
    setQuery('')
    setResults([])
  }

  return (
    <div className="relative mt-2">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1a1a1a] focus:outline-none"
      />

      {sdkError && (
        <p className="mt-1 text-[11px] text-gray-400">
          장소 검색을 쓸 수 없어요({sdkError}) — 이름만으로 추가할 수 있어요.
        </p>
      )}
      {loading && <p className="mt-1 text-[11px] text-gray-400">검색 중...</p>}

      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => handlePick(place)}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
              >
                <span className="block font-medium text-gray-900">{place.place_name}</span>
                <span className="block text-gray-400">{place.road_address_name || place.address_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim() && !loading && results.length === 0 && (
        <button type="button" onClick={handleAddAsTyped} className="mt-1 text-[11px] text-gray-500 underline">
          "{query.trim()}" 이름으로 그냥 추가하기(검색 결과 없음)
        </button>
      )}
    </div>
  )
}

export default CustomPlaceInput
