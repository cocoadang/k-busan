# 80-item investigation and attachment/backlog implementation

Production source baseline: 378e8a6, service busan-redevelopment-news-monitor in Seoul. Read-only Cloud Logging and recent collectionCycles were inspected on 2026-11-15.

The configured guard defaults to 80 in collectionPipeline.ts. It sorts all deterministic-gate survivors newest-first before consulting the analysis cache. The same oldest notices may therefore never enter analysis even though the comment promises retry next cycle. There is no durable pending-work query in the former path. The three recent cycles recorded 1,2,2 deferred items. The latest cycle made only 4 Gemini calls, used 76 cached results and reported zero failures, while again deferring two older 촉진3 notices. This is direct evidence that the observed 80-item issue is the application's scheduling logic, not a provider request-count limit. One earlier cycle separately recorded one AI_EVENT_INVALID response; that is a different failure mode.

New production processing persists registered, deterministic-gate-eligible items in a private analysisQueue before provider calls. The existing global polling lock serializes workers. A single indexed nextAttemptAt query selects oldest due work; completed results never occupy the 80-work budget. Content/model/version changes requeue work. Transient failures back off, genuine ambiguity and exhausted retries remain needs_review. Ready results survive event-persistence failures and replay without another model call; completion is acknowledged only after the existing event/document/audit persistence path succeeds. Existing Telegram duplicate guards remain intact, and old publication dates remain ineligible even when queue processing is delayed.

AttachmentReader restricts downloads and every redirect to explicit public collector domains, HTTPS and bounded file size. Native PDF pages use Poppler; image-only pages use Korean/English Tesseract; HWPX sections use bounded ZIP/XML parsing; HWP v5 uses the separate unmodified pyhwp converter. Source SHA256, file URL and page/section locator are retained. Unsupported, oversized, encrypted/unextractable or unread documents remain retry/review work, never verified evidence. Per-item file limit 5, per-file 10MiB/40 PDF pages, extracted text limits 60k/file and 90k/item. OCR advances at most three image-only PDF pages per attempt using persistent cached progress. Original HWP page numbers are not fabricated.

The public queue endpoint reveals counts only. Authenticated operators may retry a needs_review/retry item by ID; source text and the queue remain server-only under existing deny-by-default Firestore rules. Frontend shows pending/retry/review counts. Attachment text cache has expiresAt metadata (30 days; TTL policy enabled for automatic reclamation). Pending/review queue entries intentionally do not expire silently.

Validation includes >80 draining, source disappearance, restart/ready replay, retry exhaustion, changed source and project isolation, HWPX extraction, blocked redirect/SSRF and refusal to analyze unread attachments. Full model benchmark results and real Linux converter validation are recorded separately after execution. No model winner is asserted by this document.

Runtime converter validation found an undeclared upstream `six` dependency in pyhwp; the image now pins six/lxml explicitly and runs HWP/native-PDF/Korean-OCR-tool self-tests during the image build. Processing uses an overall cycle deadline, bounds provider HTTP/retry time and leaves remaining work durable instead of exceeding the request timeout. HWPX decompression and image pixel count are bounded before expensive parsing.

## 2026-11-15 검증

전체 168개 테스트·타입 검사·화면/서버 빌드 통과. 실제 Firestore 격리 컬렉션에서도 82건 → 80건 → 2건 처리 및 ready 결과 재사용을 확인했고 검증 데이터는 정리했다. 최근 30개 운영 이력에서 80건 초과로 미분석된 고유 뉴스 3건을 기존 수집 잠금 아래 복구했다(모델 호출·알림 발송 없음). 최근 주기에 반복 누락된 것은 그중 2건이다.

HWP 변환기가 `<그림>` 같은 표시만 반환하는 문서는 읽기 성공으로 표시하지 않는다. 텍스트가 포함된 별도 HWP 호환성 표본으로 런타임을 검증한다. 공개 PDF 원본 2건과 이미지 렌더링 입력으로 수행한 모델별 6회 결과는 [비교 보고서](validation/COMPARISON.md)를 참고한다. 운영 기본 모델은 Gemini이며 OpenAI 키는 비교 작업에만 사용한다.

인증된 운영자 검증은 POST `/api/pipeline/run?notify=false`로 알림 없이 기존 저장·분석 경로를 실행할 수 있다. 기존 화면 버튼과 예약 수집의 알림 동작은 유지된다.

Bounded, completely extracted attachment text is passed in full to the model (up to the existing 90k/item cap), so a critical clause in the middle is not silently omitted by the legacy news excerpt function. Ordinary news excerpt limits remain unchanged.
