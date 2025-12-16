import { getProduct, getProducts } from "./api/productApi.js";
import { productStore, initialProductState } from "./stores/productStore.js";
import { PRODUCT_ACTIONS } from "./stores/actionTypes.js";
import { NotFoundPage } from "./pages/index.js";
import { cartStore, uiStore } from "./stores/index.js";
import { generatePageTitle } from "./utils/titleUtils.js";
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

  // 홈페이지
  if (pathname === "/" || pathname === "") {
    return { path: "/", params: {}, handler: "HomePage" };
  }

  // 상품 상세 페이지: /product/:id/
  const productMatch = pathname.match(/^\/product\/([^/]+)\/?$/);
  if (productMatch) {
    return {
      path: "/product/:id/",
      params: { id: productMatch[1] },
      handler: "ProductDetailPage",
    };
  }

  // 404
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
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SETUP,
      payload: { ...initialProductState },
    });

    // cartStore와 uiStore는 초기 상태로 시작 (서버 사이드에서는 localStorage 없음)
    // 클라이언트에서 hydration 시 localStorage에서 복원됨

    // 라우트에 따라 데이터 프리페칭
    if (route.handler === "HomePage") {
      // 홈페이지: 상품 목록과 카테고리 로드
      // SSR에서는 MSW 대신 items.json을 직접 로드하여 서버 API 미들웨어와 동일한 로직 사용
      let productsData = [];
      let categoriesData = {};
      let totalCountValue = 0;

      try {
        console.log("[SSR] 데이터 프리페칭 시작 (직접 로드):", query);

        // items.json 직접 로드 (서버 API 미들웨어와 동일한 방식)
        const { default: items } = await import("./mocks/items.json", { with: { type: "json" } });

        // 카테고리 추출 함수 (서버 API 미들웨어와 동일)
        function getUniqueCategories() {
          const categories = {};
          items.forEach((item) => {
            const cat1 = item.category1;
            const cat2 = item.category2;
            if (!categories[cat1]) categories[cat1] = {};
            if (cat2 && !categories[cat1][cat2]) categories[cat1][cat2] = {};
          });
          return categories;
        }

        // 쿼리 파라미터 추출
        const page = parseInt(query.page ?? query.current) || 1;
        const limit = parseInt(query.limit) || 20;
        const search = query.search || "";
        const category1 = query.category1 || "";
        const category2 = query.category2 || "";
        const sort = query.sort || "price_asc";

        // 상품 필터링 (서버 API 미들웨어와 동일한 로직)
        const filteredProducts = filterProducts(items, { search, category1, category2, sort });

        // 페이지네이션
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        productsData = filteredProducts.slice(startIndex, endIndex);
        totalCountValue = filteredProducts.length;
        categoriesData = getUniqueCategories();

        console.log("[SSR] 데이터 프리페칭 완료:");
        console.log(`  - 전체 상품: ${items.length}개`);
        console.log(`  - 필터링된 상품: ${filteredProducts.length}개`);
        console.log(`  - 페이지네이션된 상품: ${productsData.length}개`);
        console.log(`  - totalCount: ${totalCountValue}`);
        console.log(`  - 카테고리 개수: ${Object.keys(categoriesData).length}`);

        productStore.dispatch({
          type: PRODUCT_ACTIONS.SETUP,
          payload: {
            products: productsData,
            categories: categoriesData,
            totalCount: totalCountValue,
            loading: false,
            status: "done",
          },
        });
      } catch (error) {
        console.error("[SSR] 데이터 프리페칭 오류:", error);
        console.error("[SSR] 에러 스택:", error.stack);

        // 에러 발생 시에도 기본값 설정 (최소한 빈 상태로라도 렌더링)
        productStore.dispatch({
          type: PRODUCT_ACTIONS.SETUP,
          payload: {
            products: productsData,
            categories: categoriesData,
            totalCount: totalCountValue,
            loading: false,
            status: "done",
            error: error.message || "데이터를 불러오는 중 오류가 발생했습니다.",
          },
        });
      }
    } else if (route.handler === "ProductDetailPage") {
      // 상품 상세 페이지: 상품 상세 정보 로드
      const productId = route.params.id;
      const product = await getProduct(productId);

      productStore.dispatch({
        type: PRODUCT_ACTIONS.SET_CURRENT_PRODUCT,
        payload: product,
      });

      // 관련 상품 로드 (같은 category2 기준)
      if (product.category2) {
        try {
          const relatedResponse = await getProducts({
            category2: product.category2,
            limit: 20,
            page: 1,
          });
          const relatedProducts = relatedResponse.products.filter((p) => p.productId !== productId);
          productStore.dispatch({
            type: PRODUCT_ACTIONS.SET_RELATED_PRODUCTS,
            payload: relatedProducts,
          });
        } catch (error) {
          // 관련 상품 로드 실패는 조용히 처리
          console.error("관련 상품 로드 실패:", error);
        }
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
      if (totalCount === 0 && products.length > 0) {
        console.warn("[SSR] ⚠️ 렌더링 시점에 totalCount가 0입니다. products.length로 보정합니다.");
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
      const { ProductList, SearchBar } = await import("./components/index.js");
      const { PageWrapper } = await import("./pages/PageWrapper.js");

      // 디버깅: totalCount가 제대로 전달되는지 확인
      console.log(`[SSR] HomePage 렌더링:`);
      console.log(`  - products.length: ${products.length}`);
      console.log(`  - totalCount: ${totalCount} (타입: ${typeof totalCount})`);
      console.log(`  - loading: ${loading}`);
      console.log(`  - error: ${error}`);

      // SSR에서는 totalCount가 0이어도 "총 0개"를 표시해야 할 수 있지만,
      // 테스트는 실제 데이터가 있을 때를 가정하므로, totalCount가 0이면 경고
      if (totalCount === 0) {
        console.warn("[SSR] ⚠️ totalCount가 0입니다. '총 ... 개' 텍스트가 렌더링되지 않을 수 있습니다.");
        console.warn(`  - products.length: ${products.length}`);
        console.warn(`  - error: ${error}`);
      }

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

      const { PageWrapper } = await import("./pages/PageWrapper.js");

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
    const initialState = {
      productStore: currentState,
      cartStore: cartState,
      uiStore: uiState,
    };

    // 디버깅용 로그
    console.log(`[SSR] 라우트: ${route.path || "404"}`);
    console.log(`[SSR] 데이터 프리페칭 완료:`);
    if (route.handler === "HomePage") {
      console.log(`  - 상품 개수: ${currentState.products.length}`);
      console.log(`  - 전체 개수: ${currentState.totalCount}`);
      console.log(`  - 카테고리 개수: ${Object.keys(currentState.categories).length}`);
    } else if (route.handler === "ProductDetailPage") {
      console.log(`  - 상품 ID: ${currentState.currentProduct?.productId}`);
      console.log(`  - 관련 상품 개수: ${currentState.relatedProducts.length}`);
    }
    console.log(`[SSR] HTML 렌더링 완료 (길이: ${pageHtml.length})`);

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
