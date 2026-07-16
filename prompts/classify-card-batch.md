# 카드 태그 배치 분류 작업

당신의 작업 범위는 현재 배치의 분류 결과 파일 하나를 만드는 것뿐이다.

## 반드시 읽을 파일

1. `CARD_TAGGING_RULES.md`
2. `.codex-tagging/current_batch.json`

`CARD_TAGGING_RULES.md`를 최우선 규칙으로 적용한다. 배치 안의
`allowed_tags`가 실제 출력 가능한 태그의 완전한 목록이다.

## 허용된 쓰기

오직 `.codex-tagging/current_result.json`만 생성하거나 덮어쓴다.

다음 파일은 수정, 정리, 포맷 변경, 병합하지 않는다.

- `public/data/ygo-ko-cards/manifest.json`
- `public/data/ygo-ko-cards/part-*.json`
- `app/`, `src/`, `tools/`, `tests/` 아래 프로그램 코드
- `.codex-tagging/state.json`
- `.codex-tagging/tagged_cards.json`
- `.codex-tagging/review.jsonl`

Firebase, 외부 API, 배포 환경에는 접근하거나 쓰지 않는다.

## 판단 원칙

- 카드 이름이나 카드군 지식을 근거로 태그를 추정하지 않는다.
- 각 입력 카드와 각 입력 `effect_id`를 효과 텍스트와 구조만으로 판단한다.
- 입력 카드 전부를 정확히 한 번씩 출력한다.
- 각 카드의 입력 `effect_id`도 전부 정확히 한 번씩 출력한다.
- 카드나 효과를 누락, 중복, 추가, 재분할하지 않는다.
- 배치의 `allowed_tags`에 없는 태그는 절대 출력하지 않는다.
- 확실한 태그만 기록한다. 애매한 경우 억지로 확정하지 말고
  `needs_review=true`로 표시하고 `note`에 이유를 쓴다.
- 효과 하나라도 검토 대상이면 카드도 `needs_review=true`여야 한다.
- `confidence`가 배치의 `low_confidence_threshold`보다 낮으면 반드시
  `needs_review=true`여야 한다.
- `CUSTOM`은 기존에 정의된 태그이지만, 다른 기존 태그로 표현할 수 없는
  경우에만 사용한다. 사용한 효과와 카드는 반드시 검토 대상으로 보낸다.
- 효과가 없는 것이 구조상 명확한 카드는 `effects=[]`로 그대로 출력한다.

## 출력 파일 형식

`.codex-tagging/current_result.json`은 JSON 하나여야 하며 JSON 주석이나
마크다운 코드 펜스를 포함하면 안 된다.

```json
{
  "schema_version": 1,
  "batch_id": "current_batch.json과 정확히 같은 값",
  "cards": [
    {
      "card_id": "입력과 정확히 같은 값",
      "effects": [
        {
          "effect_id": "입력과 정확히 같은 값",
          "activation_tags": [],
          "application_tags": [],
          "operation_tags": [],
          "confidence": 0.0,
          "needs_review": true,
          "note": "판정 근거 또는 수동 검토가 필요한 이유"
        }
      ],
      "confidence": 0.0,
      "needs_review": true,
      "note": "카드 전체 판정 요약"
    }
  ]
}
```

태그 배열 안의 값은 중복되면 안 된다. `confidence`는 `0.0` 이상 `1.0`
이하 숫자, `needs_review`는 JSON boolean, `note`는 문자열이어야 한다.
정확한 출력 순서는 입력 카드와 입력 효과의 순서를 유지한다.

파일을 쓴 뒤 가능하면 다음 읽기 전용 명령으로 검사한다.

```bash
python tools/card_tag_pipeline.py validate
```

검사가 실패하면 원본 데이터나 상태 파일을 건드리지 말고
`.codex-tagging/current_result.json`만 바로잡는다.

## 최종 응답

최종 응답은 설명이나 마크다운 없이
`.codex-tagging/run-status.schema.json`을 만족하는 JSON 하나만 출력한다.

- 정상 작성 및 검증 완료: `status`는 `"completed"`
- 입력/규칙/파일 문제로 안전하게 완료할 수 없음: `status`는 `"blocked"`
- `processed`: 결과에 정확히 한 번씩 기록한 카드 수
- `needs_review`: 카드 단위 검토 필요 수
- `note`: 짧은 완료 또는 차단 사유
