import { getJson, postFormData, postJson } from './apiClient'

export function createTimelineShare({ destination, timeline, summary }) {
  return postJson('/api/share/timeline', { destination, timeline, summary })
}

export function getSharedTimeline(shareId) {
  return getJson(`/api/share/timeline/${shareId}`)
}

export function createDiaryShare({ destination, title, diary, summary, snsPost, hashtags, photoCaptions, photos }) {
  const formData = new FormData()
  formData.append('destination', destination)
  formData.append('title', title)
  formData.append('diary', diary)
  formData.append('summary', summary)
  formData.append('snsPost', snsPost)
  if (hashtags && hashtags.length > 0) {
    formData.append('hashtagsJson', JSON.stringify(hashtags))
  }
  if (photoCaptions && photoCaptions.length > 0) {
    formData.append('photoCaptionsJson', JSON.stringify(photoCaptions))
  }
  ;(photos || []).forEach((photo) => {
    formData.append('photos', photo.file, photo.file.name)
  })

  return postFormData('/api/share/diary', formData)
}

export function getSharedDiary(shareId) {
  return getJson(`/api/share/diary/${shareId}`)
}
