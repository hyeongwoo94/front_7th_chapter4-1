import { registerGlobalEvents } from "./utils/index.js";
import { initRender } from "./render.js";
import { registerAllEvents } from "./events.js";
import { loadCartFromStorage } from "./services/index.js";
import { router } from "./router/index.js";
import { BASE_URL } from "./constants.js";
import { productStore } from "./stores/index.js";
import { PRODUCT_ACTIONS } from "./stores/actionTypes.js";

const enableMocking = () =>
  import("./mocks/browser.js").then(({ worker }) =>
    worker
      .start({
        serviceWorker: {
          url: `${BASE_URL}mockServiceWorker.js`,
        },
        onUnhandledRequest: "bypass",
      })
      .then(() => {
        console.log("[MSW] 워커가 시작되었습니다. API 요청을 intercept합니다.");
      })
      .catch((error) => {
        console.error("[MSW] 워커 시작 실패:", error);
      }),
  );

/**
 * 서버에서 전달된 초기 상태를 클라이언트 스토어에 복원 (Hydration)
 */
function hydrateStores() {
  // window.__INITIAL_DATA__에서 서버 상태 읽기
  const initialState = window.__INITIAL_DATA__ || {};

  // 디버깅: window.__INITIAL_DATA__ 존재 여부 확인
  if (typeof window.__INITIAL_DATA__ === "undefined") {
    console.warn("[Hydration] window.__INITIAL_DATA__가 정의되지 않았습니다. CSR 모드로 동작합니다.");
    console.warn("  - 서버 사이드 렌더링이 제대로 작동하지 않았을 수 있습니다.");
    console.warn("  - 페이지를 새로고침하거나 서버를 확인해주세요.");
    return;
  }

  if (!initialState.productStore) {
    console.warn("[Hydration] 서버에서 전달된 초기 상태에 productStore가 없습니다. CSR 모드로 동작합니다.");
    console.warn("  - initialState:", initialState);
    return;
  }

  // productStore 상태 복원
  productStore.dispatch({
    type: PRODUCT_ACTIONS.SETUP,
    payload: initialState.productStore,
  });

  // 서버-클라이언트 데이터 일치 확인
  const restoredState = productStore.getState();
  const serverState = initialState.productStore;

  // 디버깅용 로그
  console.log("[Hydration] productStore 상태 복원 완료");
  if (serverState.products) {
    console.log(`  - 서버 상품 개수: ${serverState.products.length}`);
    console.log(`  - 복원된 상품 개수: ${restoredState.products.length}`);
    if (serverState.products.length !== restoredState.products.length) {
      console.warn("[Hydration] 경고: 서버와 클라이언트 상품 개수가 일치하지 않습니다!");
    }
  }

  // cartStore는 localStorage를 사용하므로 서버 상태보다 우선
  // loadCartFromStorage()에서 처리됨
  if (initialState.cartStore) {
    console.log("[Hydration] cartStore 초기 상태 확인 (localStorage 우선)");
  }

  // uiStore는 클라이언트 사이드 전용이므로 서버 상태는 무시
  console.log("[Hydration] uiStore는 클라이언트 전용 (서버 상태 무시)");
}

function main() {
  // 1. 서버에서 전달된 초기 상태 복원 (Hydration)
  hydrateStores();

  // 2. 이벤트 등록
  registerAllEvents();
  registerGlobalEvents();

  // 3. 장바구니 로드 (localStorage에서, 서버 상태보다 우선)
  loadCartFromStorage();

  // 4. 렌더링 초기화 및 라우터 시작
  // 서버에서 이미 HTML이 렌더링되어 있으므로, 클라이언트에서는 이벤트만 연결
  initRender();
  router.start();
}

// import.meta.env가 존재하는지 확인
if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.MODE !== "test") {
  enableMocking().then(main);
} else {
  main();
}
