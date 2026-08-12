import { useState } from 'react'
import logo from '../assets/logo-nobg.png'

function CoverPage({ onSubmit }) {
  const [title, setTitle] = useState('')

  function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <div className="diary-cover min-h-app flex items-center justify-center px-6 py-10">
      <div className="diary-cover-spine" />
      <div className="mx-auto flex w-full max-w-xs flex-col items-center pl-4">
        <h1 className="diary-cover-title text-4xl">모두잇다.</h1>
        <img src={logo} alt="Ticket to Tale" className="mt-2 h-40 w-48 object-contain" />

        <label className="diary-cover-title-box mt-10 flex w-full flex-col items-center px-4 py-5">
          <span className="mb-2 text-xs text-[#8a7c6f]">우리들의 여행 제목을 적어주세요</span>
          <input
            className="w-full bg-transparent text-center text-base text-[#2c2420] placeholder:text-[#c3b8ab] focus:outline-none"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="예: 부산 2박 3일"
            maxLength={40}
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="mt-8 rounded-full bg-[#2c2420] px-8 py-2.5 text-sm text-white transition-opacity disabled:opacity-30"
        >
          다음
        </button>
      </div>
    </div>
  )
}

export default CoverPage
