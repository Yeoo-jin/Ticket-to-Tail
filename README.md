# 코레일 × 인천국제공항공사 해커톤  
# 내일路(로) 해커톤 2026  
# Ticket to Tale 개발 가이드

항공·철도 예매정보와 동행 조건을 바탕으로 적합한 관광지를 추천하고, 사용자가 선택한 장소를 기반으로 여행 타임라인과 AI 여행 다이어리를 생성하는 모바일 웹 프로토타입입니다.

이 문서는 개발 경험이 많지 않은 팀원도 같은 방식으로 작업할 수 있도록 프로젝트 실행 방법, Claude Code 사용법, Git 협업 규칙, 폴더 구조, 배포 방법 및 주의사항을 정리한 문서입니다.

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

## 8. GitHub Codespaces 사용

1. GitHub 저장소로 이동합니다.
2. `Code` 버튼을 누릅니다.
3. `Codespaces` 탭을 선택합니다.
4. 각자 본인의 Codespace를 생성합니다.
5. 터미널에서 현재 브랜치를 확인합니다.

```bash
git branch --show-current
```

브랜치가 다르면 본인 브랜치로 변경합니다.

```bash
git checkout <본인 브랜치>
```

예시:

```bash
git checkout junyoung
```

각 팀원은 자신의 Codespace를 따로 사용합니다.

하나의 Codespace를 여러 명이 공유하지 않습니다.

---

## 9. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

터미널에 표시된 주소를 브라우저에서 엽니다.

Codespaces에서는 `PORTS` 탭에 나타난 프론트엔드 포트를 열어 확인합니다.

### 실행 종료

실행 중인 터미널에서 다음 키를 누릅니다.

```text
Ctrl + C
```

### 프론트엔드 빌드 확인

작업이 끝난 뒤 다음 명령을 실행합니다.

```bash
cd frontend
npm run build
```

`npm run build`가 실패하면 완료로 보고하지 않습니다.

---

## 10. 백엔드 실행

### Windows PowerShell

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### macOS·Linux·Codespaces

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

백엔드 기본 주소:

```text
http://localhost:8000
```

FastAPI 자동 API 문서:

```text
http://localhost:8000/docs
```

### 백엔드 실행 종료

실행 중인 터미널에서 다음 키를 누릅니다.

```text
Ctrl + C
```

---

## 11. 환경변수 설정

API 키는 코드에 직접 작성하거나 GitHub에 올리면 안 됩니다.

### 로컬 개발

예시 파일을 복사합니다.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Windows에서 `cp` 명령이 동작하지 않으면 파일을 직접 복사한 뒤 이름을 `.env`로 변경합니다.

예시:

```env
ANTHROPIC_API_KEY=본인의_API_KEY
VITE_API_BASE_URL=http://localhost:8000
```

### Git에 올리면 안 되는 파일

```text
.env
.env.local
venv/
node_modules/
__pycache__/
```

`.gitignore`에 위 항목이 포함되어 있는지 확인합니다.

### Codespaces Secrets

API 키는 GitHub의 Codespaces Secrets에 등록합니다.

1. GitHub 프로필 설정으로 이동
2. `Codespaces` 선택
3. `Secrets` 선택
4. `New secret` 선택
5. Secret 이름과 값을 입력
6. 사용할 저장소 접근 권한 선택

팀 채팅이나 README에 실제 API 키를 공유하지 않습니다.

프론트엔드 코드에 AI API 키를 작성하지 않습니다.

AI API 호출은 백엔드에서 처리합니다.

---

## 12. Claude Code 연결 방법

Claude Code는 VS Code 또는 Codespaces 터미널에서 실행합니다.

### 설치 여부 확인

```bash
claude --version
```

명령어를 찾을 수 없으면 설치합니다.

```bash
npm install -g @anthropic-ai/claude-code
```

설치할 때 `sudo`를 붙이지 않습니다.

### Claude Code 실행

프로젝트 최상위 폴더에서 실행합니다.

```bash
cd Ticket-to-Tale
claude
```

처음 실행할 때 각자 자신의 Claude 계정 또는 인증 수단으로 로그인합니다.

한 사람의 계정이나 API 키를 팀 전체가 공유하지 않습니다.

---

## 13. Claude Code에 처음 요청할 내용

Claude Code를 실행한 뒤 곧바로 코드를 작성하게 하지 않습니다.

먼저 프로젝트 지침과 명세를 읽고 현재 구조를 확인하도록 요청합니다.

### 서영 요청 예시

```text
CLAUDE.md와 README.md, docs 폴더의 기능명세 및 API 명세를 먼저 읽어줘.

내 담당은 전체 프론트엔드와 UI/UX야.

현재 프로젝트 구조와 이미 구현된 기능을 확인하고,
내 요청을 구현하려면 어떤 파일을 수정하거나 생성해야 하는지 먼저 알려줘.

기존 폴더 구조와 API 필드명은 변경하지 마.
다른 담당자의 파일은 수정하지 마.

아직 코드는 수정하지 마.
```

Claude Code가 수정 계획을 설명하면 내용을 확인한 뒤 구현을 요청합니다.

```text
방금 설명한 계획대로 구현해줘.

기존 기능을 유지하고 수정 범위를 최소화해줘.
API 명세에 정의된 필드명을 그대로 사용해줘.
내 담당 범위 밖의 파일은 수정하지 마.

작업 후 npm run build를 실행하고 다음 내용을 알려줘.

1. 구현한 내용
2. 수정한 파일
3. 새로 생성한 파일
4. 실행 결과
5. 남아 있는 문제
```

### 준영 요청 예시

```text
CLAUDE.md와 README.md, docs 폴더의 기능명세 및 API 명세를 먼저 읽어줘.

내 담당은 동행 조건별 관광지 추천 기준, 관광지 샘플 데이터,
추천·재추천 규칙 및 프롬프트 검수야.

backend/app/data, backend/app/prompts와 관련 문서를 먼저 확인해줘.

수정할 파일과 새로 만들 파일을 먼저 알려줘.
기존 데이터 필드명과 폴더 구조는 변경하지 마.

아직 코드는 수정하지 마.
```

### 여진 요청 예시

```text
CLAUDE.md와 README.md, docs 폴더의 기능명세 및 API 명세를 먼저 읽어줘.

내 담당은 백엔드, AI 기능, API 연결, 전체 통합 및 배포야.

backend와 frontend/src/services의 현재 구현을 먼저 확인해줘.

어떤 파일을 수정하거나 생성해야 하는지,
기존 기능에 어떤 영향을 주는지 먼저 설명해줘.

아직 코드는 수정하지 마.
```

---

## 14. Claude Code 요청 예시

### 좋은 요청

```text
현재 오류 원인을 먼저 분석하고 수정 범위를 최소화해줘.
```

```text
API 명세에 있는 요청·응답 구조를 그대로 사용해줘.
임의의 필드명을 새로 만들지 마.
```

```text
다음 파일만 수정해줘.

frontend/src/pages/PlaceSelectionPage.jsx
```

```text
코드를 수정한 뒤 npm run build가 통과하는지 확인해줘.
```

```text
기존 기능을 유지하고 최소 범위만 수정해줘.

변경 전에 현재 코드를 읽고,
변경 후 수정한 파일과 확인 방법을 알려줘.

API 키나 개인정보는 코드에 작성하지 마.
```

### 피해야 할 요청

```text
프로젝트 전체를 알아서 고쳐줘.
```

```text
다 지우고 새로 만들어줘.
```

```text
main 브랜치에 바로 올려줘.
```

```text
에러가 나는데 아무튼 되게 해줘.
```

```text
알아서 구조를 예쁘게 바꿔줘.
```

요청 범위가 너무 넓으면 Claude Code가 다른 팀원의 파일까지 수정하거나 기존 기능을 망가뜨릴 수 있습니다.

---

## 15. Claude Code 사용 시 주의사항

1. Claude Code가 작성한 코드를 확인하지 않고 바로 커밋하지 않습니다.
2. 작업 전 `git status`로 기존 변경사항을 확인합니다.
3. Claude Code가 루트의 `CLAUDE.md`를 먼저 읽었는지 확인합니다.
4. 수정할 파일과 수정하지 않을 파일을 명확히 알려줍니다.
5. 공통 데이터 구조, API 주소, 폴더명을 임의로 변경하지 않습니다.
6. 삭제 명령이나 대규모 수정이 제안되면 실행 전에 여진에게 확인합니다.
7. Claude가 `.env`나 API 키를 출력하거나 수정하지 않도록 합니다.
8. 한 번에 하나의 기능만 요청하고 실행 결과를 확인합니다.
9. 프론트 작업 후 `npm run build`를 확인합니다.
10. 백엔드 작업 후 FastAPI 서버와 `/docs`를 확인합니다.
11. Claude가 새 패키지를 설치하려 하면 왜 필요한지 확인합니다.
12. 실제로 실행하지 않은 기능을 완료로 보고하지 않습니다.
13. Claude가 수정한 파일은 `git diff`로 반드시 확인합니다.
14. `README.md`와 `CLAUDE.md`의 지침이 충돌하면 작업을 중단하고 여진에게 알립니다.
15. `docs/api-spec.md`와 실제 코드가 다르면 임의로 맞추지 말고 차이를 먼저 보고합니다.
16. Claude Code가 다른 폴더 구조를 제안해도 바로 적용하지 않습니다.
17. Claude Code에게 commit, push, merge를 자동으로 맡기지 않습니다.

---

## 16. 담당자별 주요 파일

### 여진

주요 담당 범위:

```text
backend/
frontend/src/services/
공통 데이터 구조
전체 통합
배포 설정
```

### 준영

주요 담당 범위:

```text
backend/app/data/
backend/app/prompts/
docs/
```

관광지 샘플 데이터는 다음 필드명을 사용합니다.

```json
{
  "placeId": "place-001",
  "name": "국립해양박물관",
  "description": "해양 문화를 체험할 수 있는 실내 관광지",
  "recommendationReason": "유아 동반 여행에 적합합니다.",
  "estimatedDurationMinutes": 90,
  "tags": [
    "실내",
    "유아 동반"
  ],
  "imageUrl": "/images/places/place-001.jpg"
}
```

다음 필드명을 임의로 변경하지 않습니다.

```text
placeId
name
description
recommendationReason
estimatedDurationMinutes
tags
imageUrl
```

### 서영

주요 담당 범위:

```text
frontend/src/pages/
frontend/src/components/
frontend/src/assets/
```

API 호출이 필요하면 `frontend/src/services/`에 있는 기존 함수를 사용하거나 여진과 먼저 상의합니다.

---

## 17. Git 개발 규칙

### 작업 시작 전

현재 브랜치를 확인합니다.

```bash
git branch --show-current
```

본인 브랜치가 아니면 변경합니다.

```bash
git checkout <본인 브랜치>
```

원격 변경사항을 확인합니다.

```bash
git fetch origin
```

`main`의 최신 내용을 본인 브랜치에 반영해야 할 경우 팀에 먼저 공유합니다.

```bash
git merge origin/main
```

충돌이 발생하면 임의로 해결하지 말고 여진에게 알립니다.

### 변경사항 확인

```bash
git status
git diff
```

### 커밋

한 커밋에 너무 많은 기능을 묶지 않습니다.

```bash
git add <변경한 파일>
git commit -m "feat: 관광지 선택 화면 구현"
git push origin <본인 브랜치>
```

가능하면 다음 명령으로 모든 파일을 한꺼번에 올리지 않습니다.

```bash
git add .
```

변경한 파일을 직접 지정합니다.

```bash
git add frontend/src/pages/PlaceSelectionPage.jsx
```

### 금지 명령

```bash
git push --force
```

`main` 브랜치에 직접 push하지 않습니다.

---

## 18. 커밋 메시지 규칙

| 접두어 | 용도 | 예시 |
|---|---|---|
| `feat` | 새로운 기능 | `feat: 관광지 추천 카드 구현` |
| `fix` | 오류 수정 | `fix: 선택 관광지 초기화 오류 수정` |
| `style` | UI 및 스타일 | `style: 타임라인 카드 모바일 UI 수정` |
| `refactor` | 코드 구조 개선 | `refactor: API 호출 함수 분리` |
| `docs` | 문서 수정 | `docs: API 명세 업데이트` |
| `chore` | 설정 및 기타 | `chore: 프론트 의존성 추가` |

---

## 19. Pull Request 규칙

작업을 마치면 GitHub에서 본인 브랜치에서 `main`으로 Pull Request를 생성합니다.

### PR 제목 예시

```text
[서영] 관광지 추천·선택 화면 구현
```

### PR 본문 예시

```markdown
## 작업 내용

- 관광지 추천 카드 구현
- 관광지 다중 선택 기능 구현
- 다른 장소 추천받기 버튼 추가

## 확인 방법

1. frontend 폴더에서 npm run dev 실행
2. 동행 조건 선택 후 관광지 추천 화면으로 이동
3. 관광지 선택 및 재추천 버튼 동작 확인

## 미완성 또는 확인 필요

- 실제 추천 API 연결 전
- 현재는 목업 데이터를 사용함
```

### 병합 규칙

- `main` 병합은 여진이 담당합니다.
- 본인이 PR을 만든 뒤 바로 병합하지 않습니다.
- PR에 실행 방법과 미완성 항목을 반드시 적습니다.
- 충돌이 발생하면 파일을 강제로 덮어쓰지 않습니다.

---

## 20. 프론트엔드와 백엔드 연결 규칙

프론트엔드에서 API를 호출할 때는 화면 파일에 직접 요청 코드를 반복하지 않습니다.

예시 구조:

```text
frontend/src/services/
├─ bookingApi.js
├─ placeApi.js
├─ timelineApi.js
└─ diaryApi.js
```

프론트엔드에서 사용하는 백엔드 주소는 환경변수로 관리합니다.

```env
VITE_API_BASE_URL=http://localhost:8000
```

화면에서는 서비스 함수를 불러와 사용합니다.

API 요청·응답 필드명은 `docs/api-spec.md`와 동일하게 유지합니다.

---

## 21. 배포 규칙

### 배포 전 프론트 확인

```bash
cd frontend
npm install
npm run build
```

### 배포 전 백엔드 확인

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app
```

### 필수 확인 항목

- 메인 화면이 정상적으로 열리는지
- 예매정보 텍스트 입력이 동작하는지
- 동행 조건 선택이 가능한지
- 관광지 추천 카드가 표시되는지
- 직접 선택과 AI 자동 선택이 동작하는지
- 다른 장소 추천받기가 동작하는지
- 타임라인이 생성되는지
- 다이어리가 생성되는지
- 모바일 화면이 깨지지 않는지
- 새로고침 후 치명적인 오류가 없는지
- API 키가 코드나 로그에 노출되지 않는지

---

## 22. 프론트엔드 배포

- Vercel 프로젝트를 GitHub 저장소와 연결합니다.
- 배포 기준 브랜치는 `main`으로 설정합니다.
- `VITE_API_BASE_URL`에는 배포된 백엔드 주소를 등록합니다.
- 개인 브랜치와 PR은 미리보기 배포로만 사용합니다.
- 팀원은 Vercel 설정을 임의로 변경하지 않습니다.

---

## 23. 백엔드 배포

- Render 또는 Railway에 GitHub 저장소를 연결합니다.
- 배포 기준 브랜치는 `main`으로 설정합니다.
- 시작 명령은 다음과 같이 설정합니다.

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

- AI API 키는 배포 서비스의 Environment Variables에 등록합니다.
- `.env` 파일을 배포하거나 Git에 올리지 않습니다.
- CORS 허용 주소에는 배포된 프론트엔드 주소를 등록합니다.

### 배포 담당

- 최종 배포와 환경변수 설정은 여진이 담당합니다.
- 다른 팀원은 배포 설정을 임의로 변경하지 않습니다.
- 발표 전 안정적인 배포 버전과 주소를 별도로 기록합니다.
- 발표 당일에는 새로운 기능을 추가하지 않고 오류 수정만 진행합니다.

---

## 24. 자주 발생하는 문제

### 프론트엔드 실행 오류

먼저 다음 명령을 다시 실행합니다.

```bash
cd frontend
npm install
npm run dev
```

`node_modules`나 `package-lock.json`을 임의로 삭제하지 않습니다.

삭제가 필요해 보이면 여진과 먼저 확인합니다.

### 프론트와 백엔드 연결 실패

다음 내용을 확인합니다.

- 백엔드가 실행 중인지
- `VITE_API_BASE_URL` 주소가 맞는지
- 포트 번호가 맞는지
- 백엔드 CORS 설정이 되어 있는지
- 요청 주소가 API 명세와 같은지
- 요청 필드명이 API 명세와 같은지

### Git 충돌 발생

- 다른 팀원의 파일을 강제로 덮어쓰지 않습니다.
- `git push --force`를 사용하지 않습니다.
- 충돌 화면과 `git status` 결과를 여진에게 공유합니다.

### Claude Code가 너무 많은 파일을 수정한 경우

```bash
git status
git diff
```

위 명령으로 변경사항을 확인합니다.

원하지 않는 변경은 커밋하지 않습니다.

되돌리는 명령을 확실히 모르면 직접 실행하지 말고 여진에게 문의합니다.

### API 명세와 코드가 다른 경우

- 임의로 필드명을 변경하지 않습니다.
- 현재 코드와 명세의 차이를 정리합니다.
- 여진에게 어떤 기준으로 맞출지 확인합니다.
- 확인 후 한쪽을 수정합니다.

---

## 25. 금지사항

- `main` 브랜치에 직접 push
- `git push --force` 사용
- 실제 API 키 커밋
- `.env` 파일 커밋 또는 공유
- 다른 팀원의 파일을 설명 없이 대규모 수정
- 폴더명과 API 필드명 임의 변경
- 기존 파일 무단 삭제
- 실행하지 않은 코드를 완료 처리
- 오류가 있는 상태로 PR 병합
- 발표 직전 대규모 리팩터링
- Claude Code의 변경사항을 확인하지 않고 커밋
- 공개 저장소에 개인정보나 실제 티켓 정보 업로드
- 팀원과 상의하지 않고 새로운 라이브러리 대량 설치
- 프론트엔드에 AI API 키 작성
- Claude Code에게 Git 병합이나 강제 push 맡기기

---

## 26. 작업 시작 전 체크리스트

```text
[ ] 본인 브랜치인지 확인했다.
[ ] git status로 기존 변경사항을 확인했다.
[ ] CLAUDE.md와 README.md를 읽었다.
[ ] 기능명세와 API 명세를 확인했다.
[ ] 수정할 파일 범위를 정했다.
[ ] Claude Code가 수정 계획을 먼저 설명했는지 확인했다.
[ ] 다른 담당자의 파일이 수정 범위에 포함되는지 확인했다.
[ ] API 키가 코드에 포함되지 않았는지 확인했다.
```

---

## 27. 작업 종료 전 체크리스트

```text
[ ] 기능을 직접 실행했다.
[ ] 브라우저 또는 API 문서에서 결과를 확인했다.
[ ] 오류 메시지가 없는지 확인했다.
[ ] git diff로 변경 내용을 확인했다.
[ ] 불필요한 파일이 수정되지 않았는지 확인했다.
[ ] API 명세와 필드명이 일치하는지 확인했다.
[ ] 실제 API 키가 포함되지 않았는지 확인했다.
[ ] 필요한 파일만 커밋했다.
[ ] 본인 브랜치에 push했다.
[ ] PR에 실행 방법과 미완성 항목을 작성했다.
[ ] 팀 채팅에 작업 결과를 공유했다.
```

---

## 28. iPhone Safari 로컬 테스트

같은 Wi-Fi에 있는 PC와 iPhone으로 실제 iPhone Safari에서 화면과 저장·공유 기능을 확인하는 방법입니다.

### 준비물

- PC와 iPhone이 **같은 Wi-Fi**에 연결되어 있어야 합니다(공유기 게스트망 등 분리된 네트워크는 서로 통신이 안 될 수 있습니다).
- frontend는 상대 경로(`/api/...`)로 요청하고 Vite dev server의 proxy가 backend(`127.0.0.1:8000`)로 전달하므로, `frontend/.env`의 `VITE_API_BASE_URL`은 비워둔 상태여야 합니다.

### 1. backend 실행

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. frontend를 LAN에 열기

```bash
cd frontend
npm run dev:lan
```

터미널에 `Local`과 함께 `Network` 주소가 표시됩니다. iPhone에서는 `Network`에 나온 주소가 아니라, 아래 방법으로 확인한 **Windows PC의 Wi-Fi IPv4 주소**로 접속합니다.

### 3. Windows Wi-Fi IPv4 주소 확인

명령 프롬프트(cmd)에서:

```text
ipconfig
```

"무선 LAN 어댑터 Wi-Fi" 항목의 **IPv4 주소**(예: `192.168.x.x` 형태)를 확인합니다. 이 문서에는 실제 IP 주소를 적지 않으니, 확인한 주소를 각자 기록해 사용하세요.

### 4. iPhone Safari에서 접속

iPhone Safari 주소창에 다음 형식으로 입력합니다.

```text
http://Windows_IP:5173
```

`Windows_IP`는 3번에서 확인한 주소로 바꿔 입력합니다. iPhone은 이 5173 포트(frontend)에만 접속하고, API 요청은 Vite proxy를 통해 자동으로 backend(8000)로 전달됩니다.

### WSL2 환경에서 접속되지 않을 때

이 프로젝트를 WSL2 안에서 실행 중이라면, WSL2는 자체 가상 네트워크를 쓰기 때문에 Windows의 Wi-Fi IP로 바로 접속해도 WSL2 안의 서버까지 도달하지 못할 수 있습니다. 이 경우 다음을 확인하세요.

- Windows PowerShell(관리자 권한)에서 `netsh interface portproxy`로 5173/8000 포트를 WSL2 IP로 전달하는 설정이 되어 있는지
- Windows 방화벽에서 해당 포트의 인바운드 연결이 허용되어 있는지(방화벽 설정은 자동으로 변경하지 않으므로 직접 확인·구성해야 합니다)
- 위 설정이 익숙하지 않다면 여진에게 확인을 요청하세요.

### 5. 결과 저장 확인

- **네이티브 공유가 지원되는 경우**: "iPhone에서 저장·공유" 버튼을 누르면 공유 시트가 열립니다. 공유 시트에서 **이미지 저장**을 선택하면 사진 앱에 저장됩니다.
- **HTTP 환경 등 공유가 지원되지 않는 경우**: "이미지 열기" 버튼을 누르면 화면 안에 이미지가 크게 표시됩니다. 이미지를 **길게 누르거나 Safari 공유 버튼**에서 이미지 저장을 선택하세요.
- 데스크톱에서는 기존처럼 다운로드 버튼으로 파일을 저장할 수 있습니다.

### 테스트 종료 후 서버 종료

- frontend: `npm run dev:lan`을 실행한 터미널에서 `Ctrl + C`
- backend: `uvicorn`을 실행한 터미널에서 `Ctrl + C`
- WSL2 포트 전달을 설정했다면, 더 이상 LAN 테스트가 필요 없을 때 `netsh interface portproxy delete v4tov4 ...` 명령으로 해당 규칙을 정리하는 것을 권장합니다(자동으로 삭제되지 않습니다).