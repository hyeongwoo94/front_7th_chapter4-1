import { cartStore, productStore, uiStore } from "./stores/index.js";
import { router } from "./router/index.js";
import { HomePage, NotFoundPage, ProductDetailPage } from "./pages/index.js";
import { withBatch } from "./utils/index.js";

// 홈 페이지 (상품 목록)
router.addRoute("/", HomePage);
router.addRoute("/product/:id/", ProductDetailPage);
router.addRoute(".*", NotFoundPage);

/**
 * 페이지 타이틀 업데이트 헬퍼 함수
 */
function updatePageTitle() {
  if (typeof document === "undefined") return;

  const route = router.route;
  let title = "쇼핑몰"; // 기본값

  if (route?.handler === "HomePage") {
    title = "쇼핑몰";
  } else if (route?.handler === "ProductDetailPage") {
    const productState = productStore.getState();
    const product = productState.currentProduct;
    if (product && product.title) {
      title = product.title;
    } else {
      // 상품이 아직 로드되지 않았을 때는 타이틀을 변경하지 않음
      // (이미 설정된 타이틀을 유지)
      return;
    }
  } else if (route?.handler === "NotFoundPage") {
    title = "페이지를 찾을 수 없습니다 - 쇼핑몰";
  }

  // 타이틀이 변경된 경우에만 업데이트 (불필요한 DOM 조작 방지)
  if (document.title !== title) {
    document.title = title;
  }
}

/**
 * 전체 애플리케이션 렌더링
 */
export const render = withBatch(() => {
  const rootElement = document.getElementById("root");
  if (!rootElement) return;

  const PageComponent = router.target;

  // App 컴포넌트 렌더링
  rootElement.innerHTML = PageComponent();

  // 렌더링 후 타이틀 업데이트 (렌더링 이후에 실행되도록 보장)
  // queueMicrotask 이후에 실행되도록 setTimeout 사용
  // 상품 상세 페이지일 때는 더 긴 지연 시간 사용 (상품 데이터 로드 대기)
  const delay = router.route?.handler === "ProductDetailPage" ? 10 : 0;
  setTimeout(() => {
    updatePageTitle();
  }, delay);
});

/**
 * 렌더링 초기화 - Store 변화 감지 설정
 */
export function initRender() {
  // 각 Store의 변화를 감지하여 자동 렌더링
  // render() 내부에서 updatePageTitle()이 호출되므로 여기서는 render()만 호출
  productStore.subscribe(render);
  cartStore.subscribe(render);
  uiStore.subscribe(render);
  router.subscribe(render);
}
