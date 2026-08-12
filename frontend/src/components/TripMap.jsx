import { useEffect, useRef, useState } from 'react'
import { dateKey } from '../utils/timelineDisplay'
import { loadKakaoMaps } from '../utils/loadKakaoMaps'

// 날짜(며칠차)별로 선을 구분해 보여주기 위한 색상 팔레트. 5일을 넘어가면 다시 처음부터 돈다.
const DAY_COLORS = ['#1a1a1a', '#c9873f', '#5b8fd6', '#8a5a3f', '#4a7a4a']

// 타임라인의 관광지·음식점 방문 순서를 지도 위에 마커로 찍고, 같은 날짜끼리 방문 순서대로
// 직선(실제 도로 경로가 아님)으로 이어서 보여준다. 좌표는 각 타임라인 항목에 실려 오는
// lat/lng을 우선 쓰고(공유된 타임라인처럼 placeCoordinates가 없는 화면에서도 동작하도록),
// 없으면 placeCoordinates(placeId -> {lat,lng,name}) 조회로 보완한다.
function TripMap({ timeline, placeCoordinates = {} }) {
  const containerRef = useRef(null)
  const [error, setError] = useState('')
  const [hasPoints, setHasPoints] = useState(true)

  useEffect(() => {
    let cancelled = false

    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !containerRef.current) return

        const daysInOrder = []
        const pointsByDay = {}
        timeline.forEach((item) => {
          if (item.type !== 'attraction' && item.type !== 'meal') return
          const coord =
            item.lat != null && item.lng != null
              ? { lat: item.lat, lng: item.lng }
              : item.placeId && placeCoordinates[item.placeId]
          if (!coord) return

          const key = dateKey(item.startTime)
          if (!pointsByDay[key]) {
            pointsByDay[key] = []
            daysInOrder.push(key)
          }
          pointsByDay[key].push({ ...coord, title: item.title })
        })

        const allPoints = daysInOrder.flatMap((key) => pointsByDay[key])
        if (allPoints.length === 0) {
          if (!cancelled) setHasPoints(false)
          return
        }

        const center = new kakao.maps.LatLng(allPoints[0].lat, allPoints[0].lng)
        const map = new kakao.maps.Map(containerRef.current, { center, level: 8 })
        const bounds = new kakao.maps.LatLngBounds()

        daysInOrder.forEach((key, dayIndex) => {
          const points = pointsByDay[key]
          const color = DAY_COLORS[dayIndex % DAY_COLORS.length]
          const path = points.map((point) => new kakao.maps.LatLng(point.lat, point.lng))

          path.forEach((position, index) => {
            bounds.extend(position)
            new kakao.maps.Marker({ map, position, title: points[index].title })
          })

          if (path.length > 1) {
            new kakao.maps.Polyline({
              map,
              path,
              strokeWeight: 4,
              strokeColor: color,
              strokeOpacity: 0.8,
              strokeStyle: 'solid',
            })
          }
        })

        map.setBounds(bounds)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [timeline, placeCoordinates])

  if (error) {
    return (
      <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500">
        지도를 불러오지 못했어요. ({error})
      </p>
    )
  }

  if (!hasPoints) {
    return (
      <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500">
        지도에 표시할 위치 정보가 있는 일정이 없어요.
      </p>
    )
  }

  return <div ref={containerRef} className="h-72 w-full rounded-lg border border-gray-200" />
}

export default TripMap
