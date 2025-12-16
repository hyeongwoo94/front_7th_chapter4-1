import { getCategories, getProduct, getProducts } from "../api/productApi.js";
import { initialProductState, productStore, PRODUCT_ACTIONS } from "../stores/index.js";
import { router } from "../router/index.js";

export const loadProductsAndCategories = async () => {
  router.query = { current: undefined }; // 항상 첫 페이지로 초기화
  productStore.dispatch({
    type: PRODUCT_ACTIONS.SETUP,
    payload: {
      ...initialProductState,
      loading: true,
      status: "pending",
    },
  });

  try {
    const [
      {
        products,
        pagination: { total },
      },
      categories,
    ] = await Promise.all([getProducts(router.query), getCategories()]);

    // 페이지 리셋이면 새로 설정, 아니면 기존에 추가
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SETUP,
      payload: {
        products,
        categories,
        totalCount: total,
        loading: false,
        status: "done",
      },
    });
  } catch (error) {
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SET_ERROR,
      payload: error.message,
    });
    throw error;
  }
};

/**
 * 상품 목록 로드 (새로고침)
 */
export const loadProducts = async (resetList = true) => {
  try {
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SETUP,
      payload: { loading: true, status: "pending", error: null },
    });

    const {
      products,
      pagination: { total },
    } = await getProducts(router.query);
    const payload = { products, totalCount: total };

    // 페이지 리셋이면 새로 설정, 아니면 기존에 추가
    if (resetList) {
      productStore.dispatch({ type: PRODUCT_ACTIONS.SET_PRODUCTS, payload });
      return;
    }
    productStore.dispatch({ type: PRODUCT_ACTIONS.ADD_PRODUCTS, payload });
  } catch (error) {
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SET_ERROR,
      payload: error.message,
    });
    throw error;
  }
};

/**
 * 다음 페이지 로드 (무한 스크롤)
 */
export const loadMoreProducts = async () => {
  const state = productStore.getState();
  const hasMore = state.products.length < state.totalCount;

  if (!hasMore || state.loading) {
    return;
  }

  router.query = { current: Number(router.query.current ?? 1) + 1 };
  await loadProducts(false);
};
/**
 * 상품 검색
 */
export const searchProducts = (search) => {
  router.query = { search, current: 1 };
};

/**
 * 카테고리 필터 설정
 */
export const setCategory = (categoryData) => {
  router.query = { ...categoryData, current: 1 };
};

/**
 * 정렬 옵션 변경
 */
export const setSort = (sort) => {
  router.query = { sort, current: 1 };
};

/**
 * 페이지당 상품 수 변경
 */
export const setLimit = (limit) => {
  router.query = { limit, current: 1 };
};

/**
 * 상품 상세 페이지용 상품 조회 및 관련 상품 로드
 */
export const loadProductDetailForPage = async (productId) => {
  try {
    const currentProduct = productStore.getState().currentProduct;
    if (productId === currentProduct?.productId) {
      // 관련 상품 로드 (같은 category2 기준)
      if (currentProduct.category2) {
        await loadRelatedProducts(currentProduct.category2, productId);
      }
      return;
    }
    // 현재 상품 클리어
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SETUP,
      payload: {
        ...initialProductState,
        currentProduct: null,
        loading: true,
        status: "pending",
      },
    });

    const product = await getProduct(productId);

    // 현재 상품 설정
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SET_CURRENT_PRODUCT,
      payload: product,
    });

    // 타이틀 업데이트 (명시적으로 호출, 비동기로 처리하여 render() 이후에 실행되도록)
    if (typeof document !== "undefined" && product && product.title) {
      // setTimeout을 사용하여 배치 처리 이후에 실행되도록 보장
      // 관련 상품 로드가 완료된 후에도 타이틀을 다시 확인하도록 더 긴 지연 시간 사용
      setTimeout(() => {
        document.title = product.title;
      }, 50);
    }

    // 관련 상품 로드 (같은 category2 기준)
    if (product.category2) {
      await loadRelatedProducts(product.category2, productId);
    }

    // 관련 상품 로드 후에도 타이틀 재확인 (덮어써지지 않도록)
    if (typeof document !== "undefined" && product && product.title) {
      setTimeout(() => {
        if (document.title !== product.title) {
          document.title = product.title;
        }
      }, 100);
    }
  } catch (error) {
    console.error("상품 상세 페이지 로드 실패:", error);
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SET_ERROR,
      payload: error.message,
    });
    throw error;
  }
};

/**
 * 관련 상품 로드 (같은 카테고리의 다른 상품들)
 */
export const loadRelatedProducts = async (category2, excludeProductId) => {
  try {
    const params = {
      category2,
      limit: 20, // 관련 상품 20개
      page: 1,
    };

    const response = await getProducts(params);

    // 현재 상품 제외
    const relatedProducts = response.products.filter((product) => product.productId !== excludeProductId);

    productStore.dispatch({
      type: PRODUCT_ACTIONS.SET_RELATED_PRODUCTS,
      payload: relatedProducts,
    });
  } catch (error) {
    console.error("관련 상품 로드 실패:", error);
    // 관련 상품 로드 실패는 전체 페이지에 영향주지 않도록 조용히 처리
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SET_RELATED_PRODUCTS,
      payload: [],
    });
  }
};
