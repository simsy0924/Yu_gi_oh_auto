# Yu-Gi-Oh! Ghost Duel

모바일 가로 화면에서 고스트와 연습하는 1인용 듀얼 클라이언트입니다.
기존 UI에 **실제 YGOPro / EDOPro 코어(WebAssembly)**, **CardScripts Lua 효과**,
**BabelCDB 카드 데이터**를 연결했습니다. 코어는 Web Worker에서 실행합니다.

## 실행

Node.js 22 이상:

```sh
npm ci
npm test
npm run dev
```

배포 빌드는 `npm run build`. `dist/` 전체를 정적 호스팅하세요.
루트 HTML을 직접 열거나 소스만 정적 서버에 올리는 방식은 지원하지 않습니다.
GitHub Pages용 Actions 워크플로가 포함되어 있으며 Pages Source는
**GitHub Actions**여야 합니다. 기본 덱과 고스트는 곧바로 실행할 수 있습니다.
초기 다운로드는 코어 및 압축 카드/스크립트/한국어 데이터 약 9 MB입니다.

## 현재 기능

- 내 덱: YDK 또는 `{ "main": [카드번호], "extra": [], "side": [] }` JSON 불러오기.
- 40~60장 메인 덱, 엑스트라/사이드 각각 최대 15장, 동일 카드 최대 3장 검증.
  금제 및 특정 포맷의 참가 가능 여부는 검사하지 않습니다.
- 실제 소환, 효과 발동, 체인, 공격, 페이즈 이동, 카드/존/표시 형식 선택.
- 필드·패·묘지·제외·엑스트라·LP·턴·승패를 코어 상태로 갱신.
- 상대 카드 방향 180도, 링크 마커 표시, 비공개 상대 카드 정보 숨김.
- 고스트 자동 진행 / 일시정지 / 한 행동 진행, 종료 시 Worker 정리.
- 한국어 카탈로그에 있는 공식 명칭·효과 텍스트 사용. 미수록 카드는 영어 표시.
- 요청과 응답은 Worker 내부에서 검증하며, 빈 체인 확인은 자동 처리.

## 고스트 JSON

배포 데이터는 `public/ghosts/`에 있습니다. `index.json`은 기존과 같은
`[{"id":"sample","file":"./ghosts/sample.json"}]` 형식을 유지합니다.
사용자 JSON을 선택 화면에서 직접 불러올 수도 있습니다.

```json
{
  "version": 1,
  "id": "my-ghost",
  "name": "My Ghost",
  "deck": { "main": [], "extra": [], "side": [] },
  "behavior": {
    "type": "scripted",
    "script": [
      { "on": "SELECT_IDLECMD", "action": "activate", "card": 55144522 }
    ],
    "fallback": "basic"
  }
}
```

위 빈 `main`은 형식 예시입니다. 실제 파일에는 40~60개의 카드 번호를 넣으세요.
`script`는 다음 단계의 `on`과 코어 요청이 일치하면 순서대로 소비됩니다.
`action`은 `summon`, `special`, `set`, `set-spell`, `position`, `activate`,
`attack`, `battle`, `main2`, `end`, `pass`, `yes`, `no`, `select`, `finish` 중 하나입니다.
`card`로 카드 번호를 추가 제한할 수 있습니다. 동일한 카드/효과가 여럿이면
첫 후보가 선택되므로 위치까지 특정하려면 `choice`(현재 요청의 0부터 시작하는
버튼 ID)를 사용하세요. 복수 선택은 `indices: [0, 1]`로 지정합니다.

`basic` 폴백은 일반 소환 → 공격 → 페이즈 이동을 우선하고 선택 가능한 첫
대상/존을 사용합니다. 선택적 체인은 넘깁니다. 고급 전략 AI나 특정 덱의
완성된 전개 재현기는 아닙니다. JSON을 작성하면 효과 발동을 지정할 수 있습니다.
`fallback: "pause"`는 정의되지 않은 상황에서 고스트를 중단합니다.
다음 단계가 요구한 행동이 현재 불가능한 경우에도 중단 사유를 표시합니다.

## 현재 제한

코어 자체가 처리하는 룰 범위와 이 클라이언트의 선택 UI 범위는 다릅니다.
합계 소재 선택(`SELECT_SUM`), 카운터 분배, 카드명·종족·속성 선언은 아직
UI가 지원하지 않으며, 만나면 듀얼을 명시적으로 중단합니다.
카드/체인 순서는 현재 기본 순서 유지만 가능합니다.
고스트는 전체 덱 전략을 이해하지 않습니다. 특히 반복되는 소재 선택이나
발동 조건에는 해당 덱에 맞는 JSON 행동을 추가해야 합니다.
별도 마스터 듀얼 금제/독자 카드 풀, 카드 이미지, 리플레이 저장은 없습니다.

## 재현성과 검증

- `npm test`: 실제 WASM 코어로 완주, Lua 효과/체인/드로우, 덱 검증,
  상대 정보 은닉, 상대 기준 존 마스크 및 선택 검증.
- `npm run build`: GitHub Pages 하위 경로에 맞는 상대 경로 빌드.
- `npm run assets`: 원본 프로젝트를 `.sources/`에 가져와서 고정된 revision에서
  gzip JSON을 재생성합니다. 이미 다른 revision이 있으면 자동 변경하지 않고
  중단하므로 `scripts/prepare-assets.py`에 기록된 커밋으로 checkout하세요.
- `public/engine/sources.json`: 데이터 출처와 정확한 커밋.
- `scripts/patch-core.mjs`: 공개 npm 패키지 0.1.2에 필요한 상류 버그 수정 적용.
- 한국어 스냅샷의 출처 및 재생성 절차, 코어 전체 소스 및 빌드 절차 링크는
  [THIRD_PARTY.md](./THIRD_PARTY.md)에 있습니다.

AGPL-3.0-or-later. [LICENSE](./LICENSE), [third-party notices](./THIRD_PARTY.md).
