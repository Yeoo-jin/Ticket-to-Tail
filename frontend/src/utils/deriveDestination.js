// 역/공항 이름 -> 지역명 매핑 (데모용 최소 목록, 실제 지오코딩이 아님).
const LOCATION_REGION_MAP = {
  서울역: '서울',
  용산역: '서울',
  영등포역: '서울',
  김포공항: '서울',
  인천공항: '인천',
  부산역: '부산',
  구포역: '부산',
  김해공항: '부산',
  부산김해공항: '부산',
  동대구역: '대구',
  대구공항: '대구',
  광주송정역: '광주',
  광주공항: '광주',
  대전역: '대전',
  울산역: '울산',
  울산공항: '울산',
  강릉역: '강릉',
  전주역: '전주',
  여수엑스포역: '여수',
}

function regionOf(location) {
  if (!location) return null
  return LOCATION_REGION_MAP[location.trim()] || null
}

// 구조화된 bookings에서 여행 목적지를 최선으로 추정한다.
// 인천공항은 대부분 국제선 관문일 뿐 실제 목적지가 아닌 경우가 많아, 다른 지역이 있으면 그것을 우선한다.
// 어디까지나 초기값 추정이며, 화면에서 사용자가 직접 확인·수정할 수 있어야 한다.
export function deriveDestinationGuess(bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) return ''

  const regions = []
  bookings.forEach((booking) => {
    ;[booking.arrivalLocation, booking.departureLocation].forEach((location) => {
      const region = regionOf(location)
      if (region && !regions.includes(region)) {
        regions.push(region)
      }
    })
  })

  if (regions.length === 0) return ''

  const nonIncheon = regions.filter((region) => region !== '인천')
  return nonIncheon[0] || regions[0]
}
