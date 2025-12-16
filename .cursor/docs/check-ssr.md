# SSR 작동 확인 가이드

## 1. 브라우저 콘솔에서 확인

브라우저 개발자 도구(F12)를 열고 콘솔 탭에서 다음 명령어를 실행하세요:

```javascript
// 1. window.__INITIAL_DATA__ 확인
console.log('초기 데이터:', window.__INITIAL_DATA__);

// 2. productStore 확인
console.log('상품 개수:', window.__INITIAL_DATA__?.productStore?.products?.length);

// 3. 서버에서 렌더링된 HTML 확인
console.log('루트 요소:', document.getElementById('root')?.innerHTML.substring(0, 200));
```

**정상 작동 시:**
- `window.__INITIAL_DATA__`가 존재하고 `productStore`에 데이터가 있어야 합니다
- 콘솔에 `[Hydration] productStore 상태 복원 완료` 메시지가 보여야 합니다

## 2. 페이지 소스 보기

1. `http://localhost:5174/` 접속
2. 우클릭 → "페이지 소스 보기" (또는 `Ctrl+U`)
3. 확인 사항:
   - `<div id="root">` 안에 실제 상품 목록 HTML이 있는지
   - `<script>window.__INITIAL_DATA__ = {...}</script>`가 있는지

**정상 작동 시:**
- HTML에 상품 카드들이 이미 렌더링되어 있어야 합니다
- JavaScript 없이도 콘텐츠가 보여야 합니다

## 3. 서버 콘솔 로그 확인

서버 터미널에서 다음 로그가 보여야 합니다:

```
[Server] 요청 받음: GET /
[SSR] initialState 주입 완료 (productStore 포함)
```

## 4. 네트워크 탭 확인

1. 개발자 도구 → Network 탭 열기
2. 페이지 새로고침 (`Ctrl+R`)
3. 첫 번째 요청(문서 요청)을 클릭
4. Response 탭에서 확인:
   - HTML에 상품 목록이 포함되어 있는지
   - `window.__INITIAL_DATA__` 스크립트가 있는지

## 5. JavaScript 비활성화 테스트

1. 브라우저 설정에서 JavaScript 비활성화
2. `http://localhost:5174/` 접속
3. 상품 목록이 보이면 SSR이 정상 작동하는 것입니다

## 6. 빠른 확인 스크립트

브라우저 콘솔에 붙여넣기:

```javascript
(function checkSSR() {
  const hasInitialData = typeof window.__INITIAL_DATA__ !== 'undefined';
  const hasProducts = window.__INITIAL_DATA__?.productStore?.products?.length > 0;
  const rootHasContent = document.getElementById('root')?.innerHTML.trim().length > 0;
  
  console.log('=== SSR 확인 결과 ===');
  console.log('✅ window.__INITIAL_DATA__ 존재:', hasInitialData);
  console.log('✅ 상품 데이터 존재:', hasProducts);
  console.log('✅ 루트에 콘텐츠 존재:', rootHasContent);
  
  if (hasInitialData && hasProducts && rootHasContent) {
    console.log('✅ SSR이 정상적으로 작동하고 있습니다!');
  } else {
    console.warn('⚠️ SSR이 제대로 작동하지 않을 수 있습니다.');
  }
})();
```

