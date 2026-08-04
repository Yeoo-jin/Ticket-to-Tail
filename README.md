# 코레일 × 인천국제공항공사 해커톤  
# 내일路(로) 해커톤 2026  
# Ticket to Tale 개발 가이드

항공·철도 예매정보와 동행 조건을 바탕으로 적합한 관광지를 추천하고, 사용자가 선택한 장소를 기반으로 여행 타임라인과 AI 여행 다이어리를 생성하는 모바일 웹 프로토타입입니다.

이 문서는 프로젝트 개요, 폴더 구조, 실행 방법, 향후 개발 계획을 정리한 문서입니다.

---

## 1. 예선 구현 범위

### 필수 기능

1. 항공·철도 예매정보 텍스트 입력 및 구조화
2. 동행 조건 선택
3. 동행 조건 기반 관광지 후보 추천
4. 관광지 직접 선택 또는 AI 자동 선택
5. 다른 관광지 후보 다시 추천
6. 선택된 관광지 기반 맞춤 타임라인 생성
7. 사진·메모 기반 AI 여행 다이어리 생성

### 선택 기능

- 타임라인 재생성
- 다이어리 재생성
- 결과 일부 편집

### 본선 확장 기능

- 항공권·승차권 OCR
- 실시간 항공·철도 지연 정보 연동
- 지연 시 타임라인 자동 재구성
- 사용자 계정 및 DB 저장
- 공동 편집 및 공유
- 위치 기반 알림

---

## 2. 담당 역할

| 담당자 | 담당 영역 |
|---|---|
| 여진 | 백엔드, 예매정보 구조화, 관광지 추천 API 연결, 타임라인·다이어리 AI 기능, 전체 통합 및 배포 |
| 준영 | 동행 조건별 추천 기준, 관광지 샘플 데이터, 추천·재추천 규칙, 프롬프트 및 결과 검수 |
| 서영 | 전체 프론트엔드, UI/UX, 관광지 카드·선택 화면, 타임라인·다이어리 화면 |

### 개인 브랜치

- 여진: `yeojin`
- 준영: `junyoung`
- 서영: `seoyoung`
- 최종 통합 브랜치: `main`

`main` 브랜치에는 직접 코드를 올리지 않습니다.

각자 개인 브랜치에서 작업한 뒤 Pull Request를 생성하고, 여진이 확인한 후 `main`에 병합합니다.

---

## 3. 기술 스택

### 프론트엔드

- React
- Vite
- Tailwind CSS
- JavaScript
- 모바일 웹 형태의 반응형 UI

### 백엔드

- Python
- FastAPI
- REST API
- JSON 요청·응답
- 사진 업로드 시 `multipart/form-data`

### 데이터 저장

#### 예선

- 관광지 샘플 데이터: JSON 파일
- 입력값 및 생성 결과: React 상태 또는 `localStorage`
- 사진: 브라우저 임시 미리보기
- 로그인 및 데이터베이스 미사용

#### 본선 확장

- PostgreSQL 또는 Supabase
- Supabase Auth
- Supabase Storage
- 사용자, 여행, 타임라인, 다이어리 및 공유 정보 저장

### 배포 예정

- 프론트엔드: Vercel
- 백엔드: Render 또는 Railway
- API 키: 배포 서비스의 환경변수로 등록

---

## 4. 프로젝트 폴더 구조

```text
Ticket-to-Tale/
├─ frontend/
│  ├─ src/
│  │  ├─ components/       # 여러 화면에서 재사용하는 UI
│  │  ├─ pages/            # 각 화면 단위 컴포넌트
│  │  ├─ services/         # 백엔드 API 호출 함수
│  │  ├─ data/             # 프론트용 임시·목업 데이터
│  │  ├─ utils/            # 공통 보조 함수
│  │  ├─ assets/           # 프론트에서 사용하는 이미지·아이콘
│  │  ├─ App.jsx           # 전체 화면 흐름 및 공통 상태
│  │  └─ main.jsx          # React 시작 파일
│  ├─ public/              # 정적 이미지 및 공개 파일
│  ├─ scripts/             # 순수 JS 로직 검증 스크립트 (node scripts/verify-*.mjs)
│  ├─ package.json
│  └─ .env.example
│
├─ backend/
│  ├─ app/
│  │  ├─ routes/           # API 주소 정의
│  │  ├─ services/         # AI 호출 및 핵심 처리 로직
│  │  ├─ prompts/          # AI 프롬프트
│  │  ├─ schemas/          # 요청·응답 데이터 형식
│  │  ├─ data/             # 관광지 샘플 JSON
│  │  ├─ utils/            # 공통 보조 함수
│  │  └─ main.py           # FastAPI 시작 파일
│  ├─ requirements.txt
│  └─ .env.example
│
├─ docs/
│  ├─ feature-spec.md      # 기능 및 화면 명세
│  └─ api-spec.md          # API 명세
│
├─ .gitignore
├─ CLAUDE.md               # Claude Code가 반드시 따라야 할 프로젝트 지침
└─ README.md               # 팀원이 읽는 개발·실행·협업 가이드
```

### 폴더 사용 규칙

- 프론트 화면은 `frontend/src/pages/`에 작성합니다.
- 반복해서 사용하는 버튼, 카드 등은 `frontend/src/components/`에 작성합니다.
- API 호출 코드는 화면 파일에 직접 작성하지 않고 `frontend/src/services/`에 분리합니다.
- 백엔드 API 주소는 `backend/app/routes/`에 작성합니다.
- AI 호출과 핵심 로직은 `backend/app/services/`에 작성합니다.
- AI 프롬프트는 코드 안에 길게 넣지 않고 `backend/app/prompts/`에 분리합니다.
- 관광지 샘플 데이터는 `backend/app/data/places.json`에서 관리합니다.
- 브라우저 없이 확인 가능한 순수 로직(좌표 계산, 파일명 규칙, 공유 가능 여부 판단 등)은 `frontend/scripts/`의 검증 스크립트로 확인합니다. 실행 방법: `node scripts/verify-panorama-board.mjs` (파일명은 각 스크립트마다 다름)
- 공통 데이터 구조와 API 필드명은 임의로 변경하지 않습니다.
- 새로운 폴더나 구조가 필요하면 먼저 팀에 공유합니다.

### README.md와 CLAUDE.md의 역할

- `README.md`: 팀원이 읽는 프로젝트 설명, 실행 방법, Git 협업 및 배포 가이드
- `CLAUDE.md`: Claude Code가 작업할 때 지켜야 하는 폴더 구조, 담당 범위, 보안 및 수정 규칙

Claude Code를 사용할 때는 프로젝트 최상위 폴더에서 실행하고, 작업 전에 `CLAUDE.md`, `README.md`, `docs/feature-spec.md`, `docs/api-spec.md`를 먼저 읽도록 요청합니다.

---

## 5. 전체 기능 흐름

```text
항공·철도 예매정보 텍스트 입력
→ 예매정보 구조화
→ 동행 조건 선택
→ 동행 조건 기반 관광지 추천
→ 관광지 직접 선택 또는 AI 자동 선택
→ 필요하면 다른 관광지 추천받기
→ 선택된 관광지 기반 타임라인 생성
→ 사진·메모 입력
→ AI 여행 다이어리 생성
```

### 필수 API

```text
POST /api/bookings/parse
POST /api/places/recommend
POST /api/timelines/generate
POST /api/diaries/generate
```

### 선택 API

```text
POST /api/timelines/regenerate
POST /api/diaries/regenerate
```

API 요청과 응답 형식은 `docs/api-spec.md`를 기준으로 합니다.

---

## 6. 개발 시작 순서

1. 본인의 브랜치와 Codespace를 확인합니다.
2. `git status`로 기존 변경사항을 확인합니다.
3. 프로젝트 루트에서 Claude Code를 실행합니다.
4. Claude Code에게 `CLAUDE.md`, `README.md`, 기능명세와 API 명세를 먼저 읽게 합니다.
5. Claude Code가 수정할 파일과 구현 계획을 먼저 설명하게 합니다.
6. 계획을 확인한 뒤 구현을 요청합니다.
7. 구현 후 직접 실행하거나 빌드합니다.
8. `git diff`로 변경사항을 확인합니다.
9. 본인의 브랜치에만 commit 및 push합니다.
10. Pull Request를 생성합니다.
11. 여진이 확인한 뒤 `main`에 병합합니다.

---

## 7. 프로젝트 처음 실행하기

### 로컬 VS Code

```bash
git clone <저장소 주소>
cd Ticket-to-Tale
git checkout <본인 브랜치>
```

예시:

```bash
git checkout seoyoung
```

현재 브랜치를 확인합니다.

```bash
git branch --show-current
```

---

## 8. iPhone Safari 테스트 (Codespaces + ngrok)

실제 iPhone Safari에서 화면과 저장·공유 기능을 확인하는 방법입니다. **Codespaces + ngrok 방식을 기본으로 사용합니다** — Wi-Fi가 같지 않아도 되고, ngrok 터널은 HTTPS라서 `navigator.share`(공유 시트) 같은 보안 컨텍스트가 필요한 기능도 별도 설정 없이 동작합니다.

### 준비물

- GitHub 저장소의 `Code` → `Codespaces` 탭에서 Codespace가 열려 있어야 합니다.
- Codespace 터미널에서 [ngrok](https://ngrok.com)이 설치되어 있어야 합니다. 처음 사용한다면 ngrok 계정을 만들고 `ngrok config add-authtoken <본인 토큰>`을 먼저 실행합니다.
- `frontend/.env`의 `VITE_API_BASE_URL`은 비워둔 상태여야 합니다(비워두면 상대 경로로 요청하고 Vite proxy가 backend로 전달합니다).
- Gemini API 키는 `backend/.env`의 `GEMINI_API_KEY`에 설정하거나, GitHub Codespaces Secrets(GitHub 프로필 설정 → `Codespaces` → `Secrets`)에 `GEMINI_API_KEY`로 등록해두면 Codespace 생성 시 자동으로 주입됩니다.

### 1. backend 실행 (터미널 1)

```bash
cd ~/Ticket-to-Tail/backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. frontend 실행 (터미널 2)

```bash
cd ~/Ticket-to-Tail/frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

### 3. ngrok으로 frontend 포트를 외부에 열기 (터미널 3)

```bash
ngrok http --host-header=rewrite 5173
```

`--host-header=rewrite`가 꼭 필요합니다. 이 옵션이 없으면 Vite dev server가 ngrok이 보낸 요청의 Host 헤더를 낯선 주소로 인식해 `Blocked request` 오류로 거부할 수 있습니다.

실행하면 터미널에 `Forwarding https://xxxx.ngrok-free.app -> http://localhost:5173` 형태의 주소가 표시됩니다. 이 `https://` 주소가 iPhone에서 접속할 주소입니다(이 문서에는 실제 주소를 적지 않으니 각자 실행 결과를 확인하세요).

API 요청(`/api/...`)은 frontend가 상대 경로로 보내고 Vite proxy가 backend(8000)로 그대로 전달하므로, iPhone은 이 ngrok 주소 하나에만 접속하면 됩니다.

### 4. iPhone Safari에서 접속

iPhone Safari 주소창에 3번에서 확인한 `https://xxxx.ngrok-free.app` 주소를 입력합니다. ngrok 무료 플랜은 처음 접속 시 경고 화면이 뜰 수 있는데, **Visit Site**를 눌러 진행합니다.

### 5. 결과 저장 확인

- **네이티브 공유가 지원되는 경우**: "iPhone에서 저장·공유" 버튼을 누르면 공유 시트가 열립니다. 공유 시트에서 **이미지 저장**을 선택하면 사진 앱에 저장됩니다.
- **공유가 지원되지 않는 경우**: "이미지 열기" 버튼을 누르면 화면 안에 이미지가 크게 표시됩니다. 이미지를 **길게 누르거나 Safari 공유 버튼**에서 이미지 저장을 선택하세요.
- 데스크톱에서는 기존처럼 다운로드 버튼으로 파일을 저장할 수 있습니다.

### 테스트 종료 후 서버 종료

터미널 1·2·3에서 각각 `Ctrl + C`로 backend, frontend, ngrok을 종료합니다. ngrok 무료 플랜은 터널 주소가 매번 바뀌므로, 다시 테스트할 때는 3번부터 다시 실행하고 iPhone에서 새 주소로 접속합니다.

### 로컬(WSL2 등)에서 같은 Wi-Fi로 직접 연결하는 경우

Codespaces 없이 로컬 PC에서 같은 방식으로 테스트하려면, backend는 위 1번과 동일하게 `--host 0.0.0.0`으로 실행하고 frontend는 `npm run dev:lan`(`vite --host 0.0.0.0 --port 5173 --strictPort`와 동일)으로 실행한 뒤, PC의 Wi-Fi IPv4 주소(`ipconfig`로 확인)로 iPhone에서 접속합니다. WSL2 안에서 실행 중이라면 Windows의 Wi-Fi IP로 바로 접속해도 WSL2 내부까지 도달하지 못할 수 있어(자체 가상 네트워크 사용), `netsh interface portproxy`로 포트를 전달해야 할 수 있습니다 — 이 방식은 방화벽·포트 포워딩 설정이 번거로워서, 위 Codespaces + ngrok 방식을 우선 권장합니다.

---

## 9. 향후 개발 계획

### 아직 구현하지 않은 기능

1절의 "선택 기능"·"본선 확장 기능"과 같은 내용입니다. 예선 필수 기능(F-01~F-08)은 모두 구현되어 있습니다.

**선택 기능 (예선 범위, 미구현)**

- 타임라인 재생성 (`POST /api/timelines/regenerate`) — 화면에는 "다른 일정 추천받기"/"같은 정보로 다시 생성" 버튼이 있지만, 전용 재생성 API가 아니라 기존 생성 API(`/api/timelines/generate`, `/api/diaries/generate`)를 다시 호출하는 방식으로만 동작합니다.
- 다이어리 재생성 (`POST /api/diaries/regenerate`) — 위와 동일합니다.
- 결과 일부 편집 (예: 문단 하나만 다시 쓰기 등 세밀한 편집)

**본선 확장 기능 (미구현)**

- 항공권·승차권 OCR
- 실시간 항공·철도 지연 정보 연동
- 지연 시 타임라인 자동 재구성
- 사용자 계정 및 DB 저장
- 공동 편집 및 공유
- 위치 기반 알림

### feature-spec.md 대비 화면·입력 차이

`docs/feature-spec.md`를 실제 구현과 대조했을 때 발견된 차이입니다. 기능이 빠진 것도 있고, 문서 자체가 최신 상태를 반영하지 못한 것도 있습니다. 새로 구현하기 전에 먼저 여진과 상의해주세요.

1. **메인 화면(S-01) 없음** — 서비스 소개·핵심 기능 요약·"여행 만들기" 버튼이 있는 랜딩 화면이 없고, 앱 진입 시 바로 예매정보 입력 화면(1단계)이 나옵니다.
2. **"여행 시작일·종료일 입력" 필드 없음(S-02)** — 예매정보 입력은 자유 텍스트 하나뿐이고, 항공편/철도/시작일/종료일을 구분한 입력 필드가 따로 없습니다.
3. **동행 조건 "친구"·"연인" 통합(S-03)** — `docs/api-spec.md`에 "최종 서비스 기획에 맞춰 `friends_couple` 하나로 통합했다"는 기록이 있어, 코드는 이 최신 결정을 따르고 있습니다. `feature-spec.md`만 통합 이전 표현("혼자·친구·연인·유아·고령자·교통약자·반려동물")으로 남아 있어 문서 쪽 업데이트가 필요합니다.
4. **다이어리 "분량 선택" UI 없음(S-06)** — 문체(tone) 선택만 있고 분량 선택이 없습니다. `docs/api-spec.md`의 `/api/diaries/generate` 요청 스키마 자체에도 분량 필드가 없어, API 명세와 feature-spec.md가 서로 다른 상태입니다. 분량 선택을 추가하려면 API 명세부터 먼저 정해야 합니다.
5. **"장소별 메모"가 아니라 "사진별 메모"(F-07)** — 다이어리 입력 화면은 사진마다 메모를 다는 구조이고, 타임라인의 특정 장소와 직접 연결되는 메모 입력은 없습니다. 여행 전체 메모(자유 텍스트)는 별도로 있습니다.