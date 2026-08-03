import { postFormData } from './apiClient'

export function generateDiary({
  destination,
  tone,
  memo,
  companionTypes,
  timeline,
  selectedPlaceIds,
  photoMemos,
  photos,
}) {
  const formData = new FormData()
  formData.append('destination', destination)
  formData.append('tone', tone)
  if (memo) {
    formData.append('memo', memo)
  }
  formData.append('companionTypesJson', JSON.stringify(companionTypes))
  formData.append('timelineJson', JSON.stringify(timeline))
  formData.append('selectedPlaceIdsJson', JSON.stringify(selectedPlaceIds))
  if (photoMemos && photoMemos.length > 0) {
    formData.append('photoMemosJson', JSON.stringify(photoMemos))
  }
  photos.forEach((photo) => {
    formData.append('photos', photo.file, photo.file.name)
  })

  return postFormData('/api/diaries/generate', formData)
}
