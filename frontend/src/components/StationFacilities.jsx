// 타임라인 생성 응답의 stationFacilities를 그대로 받아 표시한다(별도 API 호출 없음).
// 유아 동반/교통약자 동반이 아니면 백엔드가 항상 빈 배열을 주므로, 그 외 조건에서는
// 이 컴포넌트 자체가 아무것도 렌더링하지 않는다.
function buildBadges(facility) {
  const badges = []
  if (facility.hasNursingRoom) badges.push('🍼 수유실')
  if (facility.hasElevator) badges.push(`🛗 엘리베이터 ${facility.elevatorCount}대`)
  if (facility.escalatorCount > 0) badges.push(`↕️ 에스컬레이터 ${facility.escalatorCount}대`)
  if (facility.hasAccessibleRestroom) badges.push('♿ 장애인화장실')
  if (facility.hasWheelchairRamp) badges.push('♿ 경사로')
  if (facility.wheelchairLiftCount) badges.push(`♿ 휠체어리프트 ${facility.wheelchairLiftCount}대`)
  if (facility.hasGeneralRestroom) badges.push('🚻 화장실')
  if (facility.hasInfoCenter) badges.push('ℹ️ 종합안내센터')
  return badges
}

function StationFacilities({ stationFacilities }) {
  const facilities = (stationFacilities ?? []).filter((facility) => buildBadges(facility).length > 0)
  if (facilities.length === 0) return null

  return (
    <div className="mt-2 rounded-lg border border-gray-200 p-3">
      <p className="text-xs font-semibold text-gray-900">♿ 역 편의시설</p>
      <p className="mt-1 text-[11px] text-gray-500">공공데이터포털(한국철도공사) 기준으로, 실제와 다를 수 있습니다.</p>
      <ul className="mt-2 space-y-2">
        {facilities.map((facility) => (
          <li key={facility.stationName} className="text-xs text-gray-700">
            <p className="font-medium">{facility.stationName}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {buildBadges(facility).map((badge) => (
                <span key={badge} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                  {badge}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default StationFacilities
