# Yu-Gi-Oh! Combo Validator

사용자가 직접 카드와 덱, 전개 루트를 등록하고 패 트랩에 의해 전개가
중단되는 지점을 검사하는 유희왕 전개 검증 앱입니다.

- 현재 앱: https://yugioh-combo-validator.simsy0924.chatgpt.site
- 카드 카탈로그: 한국어 카드 13,982장
- 주요 기능: 카드·효과 태그, 덱 매수 관리, 체인/코스트 분리, 필드 시뮬레이터,
  목표 상태 검사, 패 트랩 대응안과 우회 전개

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm ci
npm run dev
```

터미널에 표시되는 로컬 주소를 브라우저에서 열면 됩니다.

## 검사 명령

```bash
npm test
npm run lint
npm run build
```

`npm test`는 배포 빌드와 카드 카탈로그 13,982장의 중복·누락 검사를 함께
실행합니다.

## 주요 폴더

- `app/page.tsx`: 카드 라이브러리, 덱, 전개 작성기와 시뮬레이터 UI
- `app/api/`: 계정 및 동기화 API
- `db/`, `drizzle/`: 서버 저장소 스키마와 마이그레이션
- `public/data/ygo-ko-cards/`: 전체 카드 카탈로그 manifest와 분할 데이터
- `tests/`: 렌더링 및 카드 데이터 무결성 검사

## 카드 카탈로그 갱신

새 단일 JSON 파일은 다음 구조를 사용합니다.

```json
{
  "updatedAt": "YYYY-MM-DD",
  "source": "자료 출처",
  "cards": []
}
```

파일을 분할 카탈로그로 변환하려면 다음 명령을 실행합니다.

```bash
node scripts/split-catalog.mjs path/to/ygo-ko-cards.json public/data/ygo-ko-cards 600
```

변환 후 `npm test`로 카드 수와 ID 중복 여부를 확인하세요. 카드 텍스트의 출처와
저작권 정보는 [THIRD_PARTY_DATA.md](./THIRD_PARTY_DATA.md)에 정리되어 있습니다.

## 저장과 배포

GitHub에는 소스 코드와 기본 카드 카탈로그만 저장됩니다. 사용자가 등록한 카드,
덱, 전개법 및 계정별 동기화 데이터는 실행 중인 서버 데이터베이스에 있으므로
GitHub 커밋에 포함되지 않습니다.

현재 공개 앱은 ChatGPT Sites에서 배포됩니다. GitHub에 push하는 것만으로 공개
앱이 자동 갱신되지는 않으며, 검증 후 Sites에도 같은 버전을 배포해야 합니다.

## 권리 고지

Yu-Gi-Oh! 카드명과 카드 텍스트의 권리는 각 권리자에게 있습니다. 이 저장소의
카드 데이터에는 별도 출처와 라이선스 조건이 적용될 수 있습니다.
