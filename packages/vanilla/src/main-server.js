import { productStore, initialProductState } from "./stores/productStore.js";
import { PRODUCT_ACTIONS } from "./stores/actionTypes.js";
import { NotFoundPage } from "./pages/index.js";
import { cartStore, uiStore } from "./stores/index.js";
import { generatePageTitle } from "./utils/titleUtils.js";
import { prefetchHomePageData, dispatchHomePageData } from "./utils/serverDataUtils.js";
import { ProductList, SearchBar } from "./components/index.js";
import { PageWrapper } from "./pages/PageWrapper.js";
import { filterProducts } from "./utils/productFilter.js";

/**
 * 서버 사이드에서 라우트 매칭
 * 클라이언트 Router와 동일한 로직이지만 window 객체 없이 동작
 */
function matchRoute(url, baseUrl) {
  // baseUrl 제거
  let pathname = url;
  if (baseUrl && pathname.startsWith(baseUrl)) {
    pathname = pathname.slice(baseUrl.length);
  }
  pathname = pathname.split("?")[0]; // 쿼리 제거
  if (!pathname.startsWith("/")) {
    pathname = "/" + pathname;
  }

  // 홈페이지: / 경로
  if (pathname === "/" || pathname === "") {
    return { path: "/", params: {}, handler: "HomePage" }; // handler는 클라이언트 컴포넌트 이름과 일치
  }

  // 상품 상세 페이지: /product/:id/ 경로
  const productMatch = pathname.match(/^\/product\/([^/]+)\/?$/);
  if (productMatch) {
    return {
      path: "/product/:id/",
      params: { id: productMatch[1] },
      handler: "ProductDetailPage", // handler는 클라이언트 컴포넌트 이름과 일치
    };
  }

  // 404: 그 외 모든 경로
  return { path: null, params: {}, handler: "NotFoundPage" };
}

/**
 * 상품 상세 페이지 렌더링 헬퍼 함수
 */
async function renderProductDetail(product, relatedProducts) {
  const {
    productId,
    title,
    image,
    lprice,
    brand,
    description = "",
    rating = 0,
    reviewCount = 0,
    stock = 100,
    category1,
    category2,
  } = product;

  const price = Number(lprice);

  // 브레드크럼 생성
  const breadcrumbItems = [];
  if (category1) breadcrumbItems.push({ name: category1, category: "category1", value: category1 });
  if (category2) breadcrumbItems.push({ name: category2, category: "category2", value: category2 });

  return `
    <!-- 브레드크럼 -->
    ${
      breadcrumbItems.length > 0
        ? `
      <nav class="mb-4">
        <div class="flex items-center space-x-2 text-sm text-gray-600">
          <a href="/" data-link class="hover:text-blue-600 transition-colors">홈</a>
          ${breadcrumbItems
            .map(
              (item) => `
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
            <button class="breadcrumb-link" data-${item.category}="${item.value}">
              ${item.name}
            </button>
          `,
            )
            .join("")}
        </div>
      </nav>
    `
        : ""
    }
    <!-- 상품 상세 정보 -->
    <div class="bg-white rounded-lg shadow-sm mb-6">
      <div class="p-4">
        <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
          <img src="${image}" alt="${title}" class="w-full h-full object-cover product-detail-image">
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-1">${brand}</p>
          <h1 class="text-xl font-bold text-gray-900 mb-3">${title}</h1>
          ${
            rating > 0
              ? `
            <div class="flex items-center mb-3">
              <div class="flex items-center">
                ${Array(5)
                  .fill(0)
                  .map(
                    (_, i) => `
                  <svg class="w-4 h-4 ${i < rating ? "text-yellow-400" : "text-gray-300"}" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                `,
                  )
                  .join("")}
              </div>
              <span class="ml-2 text-sm text-gray-600">${rating}.0 (${reviewCount.toLocaleString()}개 리뷰)</span>
            </div>
          `
              : ""
          }
          <div class="mb-4">
            <span class="text-2xl font-bold text-blue-600">${price.toLocaleString()}원</span>
          </div>
          <div class="text-sm text-gray-600 mb-4">재고 ${stock.toLocaleString()}개</div>
          ${
            description
              ? `
            <div class="text-sm text-gray-700 leading-relaxed mb-6">${description}</div>
          `
              : ""
          }
        </div>
      </div>
      <div class="border-t border-gray-200 p-4">
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm font-medium text-gray-900">수량</span>
          <div class="flex items-center">
            <button id="quantity-decrease" class="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-l-md bg-gray-50 hover:bg-gray-100">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>
            </button>
            <input type="number" id="quantity-input" value="1" min="1" max="${stock}" class="w-16 h-8 text-center text-sm border-t border-b border-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
            <button id="quantity-increase" class="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-r-md bg-gray-50 hover:bg-gray-100">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            </button>
          </div>
        </div>
        <button id="add-to-cart-btn" data-product-id="${productId}" class="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium">장바구니 담기</button>
      </div>
    </div>
    <div class="mb-6">
      <button class="block w-full text-center bg-gray-100 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-200 transition-colors go-to-product-list">상품 목록으로 돌아가기</button>
    </div>
    ${
      relatedProducts.length > 0
        ? `
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b border-gray-200">
          <h2 class="text-lg font-bold text-gray-900">관련 상품</h2>
          <p class="text-sm text-gray-600">같은 카테고리의 다른 상품들</p>
        </div>
        <div class="p-4">
          <div class="grid grid-cols-2 gap-3 responsive-grid">
            ${relatedProducts
              .slice(0, 20)
              .map(
                (relatedProduct) => `
              <div class="bg-gray-50 rounded-lg p-3 related-product-card cursor-pointer" data-product-id="${relatedProduct.productId}">
                <div class="aspect-square bg-white rounded-md overflow-hidden mb-2">
                  <img src="${relatedProduct.image}" alt="${relatedProduct.title}" class="w-full h-full object-cover" loading="lazy">
                </div>
                <h3 class="text-sm font-medium text-gray-900 mb-1 line-clamp-2">${relatedProduct.title}</h3>
                <p class="text-sm font-bold text-blue-600">${Number(relatedProduct.lprice).toLocaleString()}원</p>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      </div>
    `
        : ""
    }
  `;
}

/**
 * 서버 사이드 렌더링 함수
 * @param {string} url - 요청 URL
 * @param {Object} query - 쿼리 파라미터 객체
 * @returns {Promise<{html: string, initialState: Object}>}
 */
export const render = async (url, query = {}) => {
  try {
    // MSW는 더 이상 사용하지 않음 (직접 items.json 로드)
    // await initializeMSW();

    // baseUrl 설정 (프로덕션/개발 환경에 따라)
    const baseUrl = process.env.NODE_ENV === "production" ? "/front_7th_chapter4-1/vanilla/" : "/";

    // 라우트 매칭
    const route = matchRoute(url, baseUrl);

    // 스토어 초기화 (매 요청마다 새로 생성)
    // 서버 사이드에서는 각 요청마다 깨끗한 상태로 시작
    // 중요: 초기화 후 상태를 확인하여 제대로 초기화되었는지 검증
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SETUP,
      payload: { ...initialProductState },
    });

    // cartStore와 uiStore는 초기 상태로 시작 (서버 사이드에서는 localStorage 없음)
    // 클라이언트에서 hydration 시 localStorage에서 복원됨

    // 라우트에 따라 데이터 프리페칭
    // 중요: 모든 비동기 작업이 완료될 때까지 await하여 데이터가 완전히 로드되도록 보장
    if (route.handler === "HomePage") {
      // 홈페이지: 상품 목록과 카테고리 로드
      // SSR에서는 MSW 대신 items.json을 직접 로드하여 서버 API 미들웨어와 동일한 로직 사용
      try {
        // items.json 직접 로드 (서버 API 미들웨어와 동일한 방식)
        const itemsModule = await import("./mocks/items.json", { with: { type: "json" } });
        const items = itemsModule.default;

        // 데이터가 로드되었는지 확인
        if (!items || !Array.isArray(items) || items.length === 0) {
          throw new Error("items.json이 비어있거나 유효하지 않습니다.");
        }

        // 데이터 프리페칭 (공통 유틸리티 사용)
        const prefetchData = prefetchHomePageData(query, items);

        // 스토어에 디스패치
        dispatchHomePageData(productStore, prefetchData);

        // 디스패치 후 상태 검증
        const stateAfterDispatch = productStore.getState();
        if (!stateAfterDispatch.products || stateAfterDispatch.products.length === 0) {
          throw new Error("데이터 디스패치 실패: products가 비어있습니다.");
        }

        // 추가 검증: products 배열의 첫 번째 항목이 유효한지 확인
        if (!stateAfterDispatch.products[0] || !stateAfterDispatch.products[0].title) {
          throw new Error("데이터 검증 실패: products 배열의 첫 번째 항목이 유효하지 않습니다.");
        }
      } catch (error) {
        // 에러 발생 시에도 기본값 설정 (최소한 빈 상태로라도 렌더링)
        dispatchHomePageData(
          productStore,
          { products: [], categories: {}, totalCount: 0 },
          { error: error.message || "데이터를 불러오는 중 오류가 발생했습니다." },
        );
        // 에러를 다시 throw하여 상위에서 처리할 수 있도록 함
        throw error;
      }
    } else if (route.handler === "ProductDetailPage") {
      // 상품 상세 페이지: 상품 상세 정보 로드
      // SSR에서는 MSW 대신 items.json을 직접 로드하여 서버 API 미들웨어와 동일한 로직 사용
      const productId = route.params.id;

      try {
        // items.json 직접 로드 (서버 API 미들웨어와 동일한 방식)
        const { default: items } = await import("./mocks/items.json", { with: { type: "json" } });
        const product = items.find((item) => item.productId === productId);

        if (product) {
          // 서버 API 미들웨어와 동일한 상세 정보 구성
          const detailProduct = {
            ...product,
            description: `${product.title}에 대한 상세 설명입니다. ${product.brand} 브랜드의 우수한 품질을 자랑하는 상품으로, 고객 만족도가 높은 제품입니다.`,
            rating: Math.floor(Math.random() * 2) + 4,
            reviewCount: Math.floor(Math.random() * 1000) + 50,
            stock: Math.floor(Math.random() * 100) + 10,
            images: [product.image, product.image.replace(".jpg", "_2.jpg"), product.image.replace(".jpg", "_3.jpg")],
          };

          productStore.dispatch({
            type: PRODUCT_ACTIONS.SET_CURRENT_PRODUCT,
            payload: detailProduct,
          });

          // 관련 상품 로드 (같은 category2 기준)
          if (detailProduct.category2) {
            const filteredRelated = filterProducts(items, {
              category2: detailProduct.category2,
              limit: 20,
              page: 1,
            });
            const relatedProducts = filteredRelated.filter((p) => p.productId !== productId);
            productStore.dispatch({
              type: PRODUCT_ACTIONS.SET_RELATED_PRODUCTS,
              payload: relatedProducts,
            });
          }
        } else {
          productStore.dispatch({
            type: PRODUCT_ACTIONS.SET_ERROR,
            payload: "상품을 찾을 수 없습니다.",
          });
        }
      } catch (error) {
        productStore.dispatch({
          type: PRODUCT_ACTIONS.SET_ERROR,
          payload: error.message || "상품 상세 정보를 불러오는 중 오류가 발생했습니다.",
        });
      }
    }

    // 서버 사이드에서 페이지 렌더링
    // withLifecycle은 클라이언트 사이드 생명주기 관리이므로 서버에서는 우회
    let pageHtml = "";

    if (route.handler === "HomePage") {
      // HomePage는 router.query를 사용하므로,
      // 실제 router 객체를 조작하거나 별도 렌더링 함수 필요
      // 임시로 HomePage 컴포넌트의 렌더링 로직 직접 구현
      const productState = productStore.getState();
      let { products = [], loading = false, error = null, totalCount = 0, categories = {} } = productState;

      // SSR에서는 totalCount가 0이면 products.length를 사용 (최소한 "총 ... 개"가 렌더링되도록)
      // 하지만 데이터가 없으면 0으로 유지 (테스트는 데이터가 있을 때를 가정)
      if (totalCount === 0 && products.length > 0) {
        totalCount = products.length;
        // 스토어 상태도 업데이트
        productStore.dispatch({
          type: PRODUCT_ACTIONS.SETUP,
          payload: {
            ...productState,
            totalCount: products.length,
          },
        });
      }

      // router.query 대신 query 파라미터 사용
      const { search: searchQuery = "", limit = 20, sort = "price_asc", category1 = "", category2 = "" } = query;
      const category = { category1, category2 };
      const hasMore = products.length < totalCount;

      // HomePage의 실제 렌더링 로직 (임시)
      // TODO: HomePage 컴포넌트를 직접 호출할 수 있도록 리팩토링 필요
      pageHtml = PageWrapper({
        headerLeft: `
          <h1 class="text-xl font-bold text-gray-900">
            <a href="/" data-link>쇼핑몰</a>
          </h1>
        `.trim(),
        children: `
          <!-- 검색 및 필터 -->
          ${SearchBar({ searchQuery, limit, sort, category, categories })}
          
          <!-- 상품 목록 -->
          <div class="mb-6">
            ${ProductList({
              products,
              loading,
              error,
              totalCount,
              hasMore,
            })}
          </div>
        `.trim(),
      });
    } else if (route.handler === "ProductDetailPage") {
      // ProductDetailPage 렌더링
      const productState = productStore.getState();
      const { currentProduct: product, relatedProducts = [], error, loading } = productState;

      const loadingContent = `
        <div class="min-h-screen bg-gray-50 flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p class="text-gray-600">상품 정보를 불러오는 중...</p>
          </div>
        </div>
      `;

      const ErrorContent = ({ error }) => `
        <div class="min-h-screen bg-gray-50 flex items-center justify-center">
          <div class="text-center">
            <div class="text-red-500 mb-4">
              <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
            </div>
            <h1 class="text-xl font-bold text-gray-900 mb-2">상품을 찾을 수 없습니다</h1>
            <p class="text-gray-600 mb-4">${error || "요청하신 상품이 존재하지 않습니다."}</p>
            <button onclick="window.history.back()" 
                    class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 mr-2">
              이전 페이지
            </button>
            <a href="/" data-link class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
              홈으로
            </a>
          </div>
        </div>
      `;

      // ProductDetail 컴포넌트 로직 가져오기
      const productDetailHtml = loading
        ? loadingContent
        : error && !product
          ? ErrorContent({ error })
          : await renderProductDetail(product, relatedProducts);

      pageHtml = PageWrapper({
        headerLeft: `
          <div class="flex items-center space-x-3">
            <button onclick="window.history.back()" 
                    class="p-2 text-gray-700 hover:text-gray-900 transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <h1 class="text-lg font-bold text-gray-900">상품 상세</h1>
          </div>
        `.trim(),
        children: productDetailHtml,
      });
    } else {
      // NotFoundPage
      pageHtml = NotFoundPage();
    }

    // 현재 스토어 상태를 initialState로 추출
    const currentState = productStore.getState();
    const cartState = cartStore.getState();
    const uiState = uiStore.getState();

    // 테스트가 기대하는 형식: 최상위 레벨에 products, categories, totalCount
    // 클라이언트 호환성을 위해 productStore 구조도 유지
    const initialState = {};

    // 테스트 형식: 최상위 레벨에 직접 배치 (products가 첫 번째 속성이 되도록)
    if (currentState.products !== undefined) initialState.products = currentState.products;
    if (currentState.categories !== undefined) initialState.categories = currentState.categories;
    if (currentState.totalCount !== undefined) initialState.totalCount = currentState.totalCount;

    // 클라이언트 호환성을 위한 기존 구조도 유지
    const productStoreState = {};
    if (currentState.products !== undefined) productStoreState.products = currentState.products;
    if (currentState.totalCount !== undefined) productStoreState.totalCount = currentState.totalCount;
    if (currentState.categories !== undefined) productStoreState.categories = currentState.categories;
    if (currentState.currentProduct !== undefined) productStoreState.currentProduct = currentState.currentProduct;
    if (currentState.relatedProducts !== undefined) productStoreState.relatedProducts = currentState.relatedProducts;
    if (currentState.loading !== undefined) productStoreState.loading = currentState.loading;
    if (currentState.error !== undefined) productStoreState.error = currentState.error;
    if (currentState.status !== undefined) productStoreState.status = currentState.status;

    initialState.productStore = productStoreState;
    initialState.cartStore = cartState;
    initialState.uiStore = uiState;

    // 페이지별 타이틀 결정
    const product = route.handler === "ProductDetailPage" ? productStore.getState().currentProduct : null;
    const title = generatePageTitle(route.handler, product);

    return {
      html: pageHtml,
      initialState,
      title,
    };
  } catch (error) {
    console.error("서버 렌더링 오류:", error);
    if (error.stack) {
      console.error("에러 스택:", error.stack);
    }
    return {
      html: '<div class="p-4 text-red-600">서버 렌더링 중 오류가 발생했습니다.</div>',
      initialState: {},
      title: "서버 오류 - 쇼핑몰",
    };
  }
};
