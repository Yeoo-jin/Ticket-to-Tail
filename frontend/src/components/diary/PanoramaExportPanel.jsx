import { useEffect, useMemo, useState } from 'react'
import { canShareFiles, canUseNativeShare, downloadBlob, shareFilesOnSupportedDevice } from '../../utils/imageShare'
import { createAllPanoramaSegmentFiles, createPanoramaSegmentFile, exportFullBoard } from '../../utils/panoramaExport'
import ImagePreviewModal from './ImagePreviewModal'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function useObjectUrls(files) {
  const [urls, setUrls] = useState([])
  useEffect(() => {
    if (!files || files.length === 0) {
      setUrls([])
      return undefined
    }
    const created = files.map((file) => URL.createObjectURL(file))
    setUrls(created)
    return () => created.forEach((url) => URL.revokeObjectURL(url))
  }, [files])
  return urls
}

// 게시물(뷰포트) PNG 저장·공유 UI. "준비"(Blob/File 생성)와 "저장·공유"(이미 준비된 File 사용)를
// 분리해, PNG 생성에 걸리는 시간 때문에 navigator.share에 필요한 사용자 제스처가 사라지지
// 않게 한다. 지원하지 않는 기능(예: 공유 미지원 환경)은 버튼을 숨기고 대체 안내를 보여준다.
function PanoramaExportPanel({
  exportRefs,
  fullBoardRef,
  splitCount,
  activeViewportIndex,
  destination,
  boardStateKey,
  photosReady,
}) {
  const [currentFile, setCurrentFile] = useState(null)
  const [currentFileKey, setCurrentFileKey] = useState(null)
  const [allFiles, setAllFiles] = useState(null)
  const [allFilesKey, setAllFilesKey] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [previewFile, setPreviewFile] = useState(null)

  const shareSupported = useMemo(() => canUseNativeShare(), [])

  const expectedCurrentKey = `${boardStateKey}:${activeViewportIndex}`
  const expectedAllKey = `${boardStateKey}:${splitCount}`
  const currentReady = Boolean(currentFile) && currentFileKey === expectedCurrentKey
  const allReady = Boolean(allFiles) && allFilesKey === expectedAllKey && allFiles.length === splitCount
  const currentStale = Boolean(currentFile) && !currentReady
  const allStale = Boolean(allFiles) && !allReady

  const allThumbnailUrls = useObjectUrls(allReady ? allFiles : null)

  async function handlePrepareCurrent() {
    if (busy || !photosReady) return
    setBusy(true)
    setMessage('')
    try {
      const node = exportRefs.current[activeViewportIndex]
      const file = await createPanoramaSegmentFile(node, destination, activeViewportIndex)
      setCurrentFile(file)
      setCurrentFileKey(expectedCurrentKey)
      setMessage('현재 조각 이미지가 준비됐어요.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  function handleDownloadCurrent() {
    if (!currentReady) return
    try {
      downloadBlob(currentFile, currentFile.name)
      setMessage('다운로드를 시작했어요.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function handleShareCurrent() {
    if (!currentReady || busy) return
    setBusy(true)
    try {
      await shareFilesOnSupportedDevice([currentFile], { title: 'Ticket to Tail' })
      setMessage('공유 시트를 열었어요. 공유 시트에서 이미지 저장을 선택하세요.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handlePrepareAll() {
    if (busy || !photosReady) return
    setBusy(true)
    setMessage('')
    try {
      const nodes = exportRefs.current.slice(0, splitCount)
      const files = await createAllPanoramaSegmentFiles(nodes, destination)
      setAllFiles(files)
      setAllFilesKey(expectedAllKey)
      setMessage(`${files.length}장 이미지가 모두 준비됐어요.`)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDownloadAll() {
    if (!allReady || busy) return
    setBusy(true)
    try {
      for (let index = 0; index < allFiles.length; index += 1) {
        downloadBlob(allFiles[index], allFiles[index].name)
        // eslint-disable-next-line no-await-in-loop
        if (index < allFiles.length - 1) await wait(250)
      }
      setMessage('전체 조각 다운로드를 시작했어요.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleShareAll() {
    if (!allReady || busy) return
    setBusy(true)
    try {
      await shareFilesOnSupportedDevice(allFiles, { title: 'Ticket to Tail' })
      setMessage('공유 시트를 열었어요. 공유 시트에서 이미지 저장을 선택하세요.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleExportFullBoard() {
    if (busy || !photosReady) return
    setBusy(true)
    setMessage('')
    try {
      await exportFullBoard(fullBoardRef.current, destination)
      setMessage('전체 보드를 저장했어요.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const allShareSupported = allReady && canShareFiles(allFiles)

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-gray-500">현재 게시물</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handlePrepareCurrent}
            disabled={busy || !photosReady}
            className="rounded-lg border border-gray-300 py-2.5 text-xs font-medium text-gray-700 disabled:opacity-40"
          >
            현재 조각 준비
          </button>
          <button
            type="button"
            onClick={handleDownloadCurrent}
            disabled={!currentReady || busy}
            className="rounded-lg border border-gray-300 py-2.5 text-xs font-medium text-gray-700 disabled:opacity-40"
          >
            현재 조각 다운로드
          </button>
        </div>
        {shareSupported ? (
          <button
            type="button"
            onClick={handleShareCurrent}
            disabled={!currentReady || busy}
            className="mt-2 w-full rounded-lg border border-blue-300 py-2.5 text-xs font-medium text-blue-700 disabled:opacity-40"
          >
            iPhone에서 저장·공유
          </button>
        ) : (
          <button
            type="button"
            onClick={() => currentReady && setPreviewFile(currentFile)}
            disabled={!currentReady || busy}
            className="mt-2 w-full rounded-lg border border-blue-300 py-2.5 text-xs font-medium text-blue-700 disabled:opacity-40"
          >
            이미지 열기
          </button>
        )}
        {currentStale && <p className="mt-1 text-[11px] text-yellow-700">설정이 바뀌었어요. 다시 준비해주세요.</p>}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-gray-500">전체 {splitCount}장</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handlePrepareAll}
            disabled={busy || !photosReady}
            className="rounded-lg border border-gray-300 py-2.5 text-xs font-medium text-gray-700 disabled:opacity-40"
          >
            전체 조각 준비
          </button>
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={!allReady || busy}
            className="rounded-lg border border-gray-300 py-2.5 text-xs font-medium text-gray-700 disabled:opacity-40"
          >
            전체 조각 다운로드
          </button>
        </div>

        {allShareSupported && (
          <button
            type="button"
            onClick={handleShareAll}
            disabled={busy}
            className="mt-2 w-full rounded-lg border border-blue-300 py-2.5 text-xs font-medium text-blue-700 disabled:opacity-40"
          >
            iPhone에서 저장·공유
          </button>
        )}

        {allReady && !allShareSupported && (
          <div className="mt-2">
            <p className="mb-1 text-[11px] text-gray-500">
              이 브라우저에서는 여러 장을 한 번에 공유할 수 없어요. 각 장을 열어 개별로 저장해주세요.
            </p>
            <div className="flex gap-2 overflow-x-auto">
              {allFiles.map((file, index) => (
                <button
                  key={file.name}
                  type="button"
                  onClick={() => setPreviewFile(file)}
                  className="flex shrink-0 flex-col items-center gap-1"
                >
                  {allThumbnailUrls[index] && (
                    <img
                      src={allThumbnailUrls[index]}
                      alt={file.name}
                      className="h-16 w-auto rounded border border-gray-300 object-cover"
                    />
                  )}
                  <span className="text-[10px] text-blue-700">열기</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {allStale && <p className="mt-1 text-[11px] text-yellow-700">설정이 바뀌었어요. 다시 준비해주세요.</p>}
      </div>

      <button
        type="button"
        onClick={handleExportFullBoard}
        disabled={busy || !photosReady}
        className="w-full rounded-lg border border-gray-300 py-2.5 text-xs font-medium text-gray-600 disabled:opacity-40"
      >
        전체 보드 PNG로 저장 (선택)
      </button>

      {!photosReady && <p className="text-center text-[11px] text-gray-400">사진을 저장용으로 준비하는 중...</p>}
      {busy && <p className="text-center text-[11px] text-gray-400">이미지를 처리하는 중...</p>}
      {!busy && message && <p className="text-center text-[11px] text-gray-500">{message}</p>}

      <ImagePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  )
}

export default PanoramaExportPanel
