function LoadingIndicator({ label = '불러오는 중...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      {label}
    </div>
  )
}

export default LoadingIndicator
