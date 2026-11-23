# 미라클톡 — 5단계

구글 로그인 + 친구 목록 + 1:1 채팅 + 단체방 + 전체 채팅방 + 프로필 아바타

## 파일 구성
- `index.html` — 화면
- `app.js` — 로그인, 메시지 보내기/받기
- `style.css` — 디자인
- `avatars.js` — 직업 아바타 24개 목록 (4단계)
- `avatars/jobs/` — 라이라 아바타 그림 24장 (4단계)
- `firebase-config.js` — **행님의 Firebase 설정값을 넣는 곳**
- `firestore.rules` — 보안 규칙 (Firebase 콘솔에 붙여넣기)
- `manifest.json`, `sw.js`, `icons/` — PWA 설치용

## 설정 순서

### 1. Firebase 프로젝트 만들기
1. https://console.firebase.google.com 접속 → **프로젝트 추가**
2. 이름 입력 (예: `miracletalk`) → Google 애널리틱스는 꺼도 됩니다

### 2. 웹 앱 등록하고 설정값 복사
1. 프로젝트 개요 화면에서 **`</>` (웹)** 아이콘 클릭
2. 앱 닉네임 입력 → 등록 (Firebase 호스팅 체크는 안 해도 됨)
3. 화면에 나오는 `firebaseConfig = { ... }` 안의 값들을 `firebase-config.js`에 그대로 옮겨 넣기

### 3. Google 로그인 켜기
1. 왼쪽 메뉴 **빌드 → Authentication → 시작하기**
2. **로그인 방법** 탭 → **Google** → 사용 설정 → 프로젝트 지원 이메일 선택 → 저장

### 4. Firestore 데이터베이스 만들기
1. 왼쪽 메뉴 **빌드 → Firestore Database → 데이터베이스 만들기**
2. 위치: **asia-northeast3 (서울)** 추천 (나중에 못 바꿉니다)
3. **프로덕션 모드**로 시작
4. 만들어지면 **규칙** 탭 → 기존 내용 전부 지우고 `firestore.rules` 내용 붙여넣기 → **게시**

### 5. 내 PC에서 실행 (Windows)
`file://`로 index.html을 바로 열면 동작하지 않습니다. 이 폴더에서 명령 프롬프트를 열고:

```
python -m http.server 8000
```

브라우저에서 http://localhost:8000 접속
(localhost는 Firebase에 기본으로 허용돼 있어서 추가 설정이 필요 없습니다)

### 6. 테스트
- 크롬 일반 창 + 시크릿 창(다른 구글 계정)을 나란히 띄워서 주고받기
- 확인할 것:
  - [ ] 구글 로그인 됨
  - [ ] 메시지 보내면 상대 창에 바로 뜸
  - [ ] 내 메시지는 오른쪽, 상대는 왼쪽(사진+이름)
  - [ ] 한글 입력 후 Enter 한 번에 한 번만 전송됨
  - [ ] Shift+Enter로 줄바꿈
  - [ ] 새로고침해도 대화 기록 남아 있음

### 7. (나중에) GitHub Pages에 올릴 때
Authentication → **설정** 탭 → **승인된 도메인** → `행님아이디.github.io` 추가
안 하면 로그인할 때 "승인된 도메인" 오류가 납니다.

## 2단계 적용 방법 (1단계를 이미 해둔 경우)
1. 바뀐 파일 덮어쓰기: `index.html`, `app.js`, `style.css`, `sw.js`, `firestore.rules`, `README.md`
   (`firebase-config.js`, `manifest.json`, `icons/`는 그대로)
2. Firebase 콘솔 → Firestore Database → **규칙** 탭 → 전부 지우고 새 `firestore.rules` 붙여넣기 → **게시**
3. 브라우저 두 곳 모두 `Ctrl+Shift+R` 새로고침 → **두 계정 모두 로그아웃 후 다시 로그인**
   (다시 로그인해야 이메일이 프로필에 저장돼서 서로 찾을 수 있음)

## 2단계 테스트
- [ ] 로그인하면 하단에 친구 / 채팅 탭이 보임
- [ ] 친구 탭에서 상대 구글 이메일 입력 → 추가 → 친구 목록에 나타남
- [ ] 친구를 누르면 1:1 대화방이 열림
- [ ] 1:1 방에서 주고받기, 상대 쪽 채팅 탭에도 그 방이 생김 (상대가 나를 친구 추가 안 해도)
- [ ] 채팅 탭에서 마지막 메시지와 시간이 보이고, 최근 대화가 위로 올라옴
- [ ] 전체 채팅방도 그대로 됨 (1단계 대화 기록 유지)
- [ ] 뒤로 버튼(‹)으로 목록으로 돌아감

## 3단계 적용 방법 (2단계를 이미 해둔 경우)
1. 바뀐 파일 덮어쓰기: `index.html`, `app.js`, `style.css`, `sw.js`, `firestore.rules`, `README.md`
   (`firebase-config.js`, `manifest.json`, `icons/`는 그대로)
2. Firebase 콘솔 → Firestore Database → **규칙** 탭 → 전부 지우고 새 `firestore.rules` 붙여넣기 → **게시**
   (게시 버튼을 눌렀을 때 빨간 오류가 뜨면 그 문구를 그대로 보내주세요)
3. 브라우저 두 곳 모두 `Ctrl+Shift+R` 새로고침 (다시 로그인할 필요는 없음)

## 3단계 테스트
계정이 3개 있으면 가장 좋아요 (크롬 일반 창 + 크롬 시크릿 창 + 엣지). 2개로도 대부분 확인됩니다.
- [ ] 채팅 탭 위쪽 **+ 새 단체방** → 친구 체크 → 방 이름 입력 → 만들기 → 방이 열림
- [ ] 방 이름을 비워두면 "나, 친구1, 친구2"처럼 자동으로 붙음
- [ ] 초대받은 사람 채팅 탭에 그 방이 바로 생김 (초록 아바타, 이름 옆에 인원수)
- [ ] 단체방에서 주고받기, 상대 메시지에 이름과 사진 표시
- [ ] 채팅 목록 미리보기가 "보낸사람: 내용"으로 나옴 (내 건 "나: 내용")
- [ ] 방 오른쪽 위 **초대** → 이미 있는 사람은 "이미 참여 중"으로 흐리게 → 새 친구 초대 → 가운데에 "OO님이 OO님을 초대했습니다"
- [ ] **나가기** → 확인 → 목록으로 돌아가고 내 목록에서 방이 사라짐, 남은 사람 화면에 "OO님이 나갔습니다"
- [ ] 1:1 방에는 초대/나가기 버튼이 안 보임
- [ ] 방 오른쪽 위에 "나: 내 이름" 표시
- [ ] 1:1 방, 전체 채팅방은 그대로 됨
- [ ] 친구 고르기 창에서 ‹ 버튼으로 닫힘

## 4단계 적용 방법 (3단계를 이미 해둔 경우)
1. 바뀐 파일 덮어쓰기: `index.html`, `app.js`, `style.css`, `sw.js`, `firestore.rules`, `README.md`
   새 파일 추가: `avatars.js`, `avatars/jobs/` 폴더 (그림 24장)
   (`firebase-config.js`, `manifest.json`, `icons/`는 그대로)
2. Firebase 콘솔 → Firestore Database → **규칙** 탭 → 전부 지우고 새 `firestore.rules` 붙여넣기 → **게시**
   (바뀐 곳은 `users` 부분 한 군데: `avatar` 칸 허용)
3. 브라우저 두 곳 모두 `Ctrl+Shift+R` 새로고침

## 4단계 테스트
- [ ] 친구 탭 → 내 카드 오른쪽 **아바타** → 고르기 창 열림 (맨 위 큰 미리보기 + 구글 사진 1칸 + 직업 24칸)
- [ ] 아무거나 누르면 미리보기가 바로 바뀌고, **저장** → 창 닫히고 내 카드에 반영
- [ ] 지금 쓰는 것과 같은 걸 고르면 저장 버튼이 꺼져 있음
- [ ] 다른 브라우저(친구 쪽)에서 새로고침 없이: 친구 목록, 채팅 목록(1:1), 대화방 메시지 옆 사진이 내 아바타로 바뀜
- [ ] 단체방·전체 채팅방에서도 내 메시지 옆(상대 화면)에 아바타 표시
- [ ] 첫 칸 **구글 사진** 고르고 저장 → 원래 구글 사진으로 돌아감
- [ ] 폰 뒤로가기 / ‹ 버튼으로 고르기 창 닫힘
- [ ] 다시 로그아웃 → 로그인해도 고른 아바타 유지

### 아바타 추가하는 법
1. 그림을 `avatars/jobs/`에 넣기 (정사각형, 256px 이상. 화면에서 동그랗게 잘려 보임)
2. `avatars.js` 목록 맨 아래에 `{ id: "job_25", label: "직업명", file: "파일이름(확장자 빼고)" }` 추가
   (지금 그림은 `.webp`. PNG를 쓰려면 `avatarImagePath`의 확장자도 같이 바꾸기)
3. 이미 있는 id는 바꾸지 않기 (사람들이 고른 아바타가 id로 저장돼 있음)

## 4-2단계: 내 사진 올리기
적용: `index.html`, `app.js`, `style.css`, `sw.js`, `firestore.rules`, `README.md` 덮어쓰기
→ Firebase 콘솔에서 새 `firestore.rules` **게시** (users 부분에 `photoData` 칸 추가)

동작: 폰에서 고른 사진을 앱이 가운데 정사각형으로 자르고 256px JPEG(약 20~40KB)로 줄여서
`users/{uid}.photoData`에 저장. Firebase Storage는 안 씀 (무료 요금제 그대로).

테스트
- [ ] 아바타 고르기 창 첫 칸 **📷 사진 올리기** → 폰에서는 갤러리/카메라가 열림
- [ ] 사진 고르면 미리보기에 동그랗게 보이고 "내 사진" 칸이 생김 → **저장**
- [ ] 친구 화면(다른 계정)에서도 내 사진으로 바뀜
- [ ] 세로로 찍은 폰 사진이 옆으로 눕지 않음
- [ ] 다른 아바타로 바꿨다가 다시 "내 사진" 고르면 올린 사진이 그대로 있음

## 4-3단계: 1:1 대화방 나가기
적용: `app.js`, `style.css`, `sw.js`, `firestore.rules`, `README.md` 덮어쓰기
→ Firebase 콘솔에서 새 `firestore.rules` **게시** (users 아래 `hiddenRooms` 추가)

동작(카톡과 비슷): 내 목록에서 방이 사라지고, 다시 열면 나간 뒤의 메시지만 보임.
상대 화면은 그대로. 누구든 새 메시지를 보내면 방이 다시 나타남.

테스트
- [ ] 1:1 방 안 오른쪽 위 **나가기** → 확인 → 목록에서 사라짐
- [ ] 채팅 목록에서 방을 **꾹 누르기**(폰) / **오른쪽 클릭**(PC) → 같은 확인창
- [ ] 상대 화면에는 방과 대화가 그대로 있음
- [ ] 상대가 메시지 보내면 내 목록에 방이 다시 생기고, 열면 새 메시지만 보임
- [ ] 친구 탭에서 그 친구를 누르면 빈 방으로 새로 시작
- [ ] 단체방 꾹 누르기 → 기존 단체방 나가기 확인창

## 5단계: 스티커 보내기
적용: `index.html`, `app.js`, `style.css`, `sw.js`, `firestore.rules`, `README.md` 덮어쓰기
새 파일: `stickers.js`, `stickers/` 폴더 (`miracle_best.webp`)
→ Firebase 콘솔에서 새 `firestore.rules` **게시** (메시지에 `sticker` 칸 추가)

테스트
- [ ] 대화방 입력창 왼쪽 😊 → 스티커 칸 열림 → "미라클 최고" 누르면 바로 전송
- [ ] 말풍선 없이 움직이는 스티커가 보임 (내 쪽은 오른쪽, 상대는 왼쪽)
- [ ] 채팅 목록 미리보기에 "(스티커) 미라클 최고"
- [ ] 1:1, 단체방, 전체 채팅방 모두 됨
- [ ] 입력창을 누르면 스티커 칸이 닫힘

스티커 추가: `stickers/`에 투명 WebP(또는 PNG) 넣고 `stickers.js` 목록 맨 아래에 한 줄 추가

## 데이터 구조
```
users/{uid}                     — name, photo, email(소문자), lastLogin, avatar, photoData
users/{uid}/friends/{친구uid}    — name, photo, email, addedAt (나만 읽고 씀)
users/{uid}/hiddenRooms/{방ID}   — hiddenAt (내가 나간 1:1 방, 나만 읽고 씀)
rooms/lobby/messages/{메시지ID}   — 전체 채팅방 (방 문서 없이 메시지만)
rooms/dm_{uidA}_{uidB}          — type, members[2], memberInfo, lastMessage, createdAt, updatedAt
rooms/{자동ID}                    — 단체방: type:"group", name, members[], memberInfo, createdBy, lastMessage, createdAt, updatedAt
rooms/.../messages/{메시지ID}     — uid, name, photo, text, createdAt (+ system:true 안내 메시지, + sticker: 스티커 id)
```
1:1 방 ID는 두 사람의 uid를 정렬해서 붙이므로, 누가 먼저 열든 항상 같은 방으로 들어갑니다.

### 단체방 보안 규칙 요약
- 방 참여자만 방과 메시지를 읽고 쓸 수 있음 (나간 사람은 그 순간부터 못 봄)
- 만든 사람이 반드시 참여자, 2~50명, 방 이름 1~30자
- 초대: 참여자만 가능, 기존 사람은 못 빼고 새 사람만 추가, 다른 사람 이름 정보 수정 금지
- 나가기: 나 자신만 뺄 수 있음 (남을 내보내기 불가), 스스로 다시 들어오기 불가
- 방 이름 바꾸기, 방 삭제는 아직 막혀 있음
