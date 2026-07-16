# Yu-Gi-Oh! Combo Validator

사용자가 직접 카드·덱·전개 루트를 등록하고 패 트랩에 의해 전개가 중단되는
지점을 검사하는 유희왕 전개 검증 앱입니다.

- 공개 앱: https://simsy0924.github.io/Yu_gi_oh_auto/
- 카드 카탈로그: 한국어 카드 13,982장
- 로그인: Firebase Authentication의 Google 로그인
- 동기화: Firebase Realtime Database의 사용자 UID별 저장소

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm ci
npm run dev
```

## 검사 명령

```bash
npm test
npm run typecheck
npm run build
```

`npm test`는 GitHub Pages용 정적 빌드와 카드 13,982장의 누락·중복 검사를
함께 실행합니다.

## 배포

`main` 브랜치에 push하면 `.github/workflows/pages.yml`이 앱을 빌드하여 GitHub
Pages에 배포합니다. 저장소의 **Settings → Pages → Source**는 **GitHub
Actions**로 설정해야 합니다.

GitHub Pages는 정적 화면만 제공합니다. Google 로그인과 계정별 데이터 저장은
Firebase가 담당합니다.

## Firebase 설정

Firebase 프로젝트 `yu-gi-oh-auto`에서 다음 항목이 필요합니다.

1. Authentication의 Google 공급자 활성화
2. 승인된 도메인에 `simsy0924.github.io` 추가
3. Realtime Database 생성
4. `database.rules.json`의 보안 규칙 배포

Firebase CLI로 규칙을 배포할 때는 다음 명령을 사용할 수 있습니다.

```bash
npx firebase-tools login
npx firebase-tools deploy --only database
```

보안 규칙은 로그인한 사용자가 `/users/{자신의 UID}`만 읽고 쓸 수 있도록
제한합니다. Firebase 웹 구성값은 클라이언트 앱에 공개되는 식별자이며, 실제
접근 통제는 Authentication과 Realtime Database 규칙이 담당합니다.

## 주요 폴더

- `app/page.tsx`: 카드 라이브러리, 덱, 전개 작성기와 시뮬레이터
- `src/firebase.ts`: Google 로그인과 안전한 계정별 동기화
- `public/data/ygo-ko-cards/`: 전체 카드 manifest와 분할 데이터
- `database.rules.json`: 사용자별 Firebase 접근 규칙
- `tests/`: 정적 빌드와 카드 데이터 무결성 검사

## 카드 카탈로그 갱신

```bash
node scripts/split-catalog.mjs path/to/ygo-ko-cards.json public/data/ygo-ko-cards 600
npm test
```

카드 텍스트의 출처와 권리 정보는
[THIRD_PARTY_DATA.md](./THIRD_PARTY_DATA.md)에 정리되어 있습니다.
