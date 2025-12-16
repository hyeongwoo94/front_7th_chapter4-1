/**
 * 서버 사이드 데이터 프리페칭 유틸리티
 * SSR/SSG에서 공통으로 사용하는 데이터 로딩 로직
 */

import { filterProducts } from "./productFilter.js";
import { getUniqueCategories } from "./categoryUtils.js";
import { PRODUCT_ACTIONS } from "../stores/actionTypes.js";

/**
 * 홈페이지 데이터 프리페칭
 * @param {Object} query - 쿼리 파라미터 객체
 * @param {Array} items - 상품 목록 배열
 * @returns {Object} { products, categories, totalCount }
 */
export function prefetchHomePageData(query, items) {
  // 쿼리 파라미터 추출
  const page = parseInt(query.page ?? query.current) || 1;
  const limit = parseInt(query.limit) || 20;
  const search = query.search || "";
  const category1 = query.category1 || "";
  const category2 = query.category2 || "";
  const sort = query.sort || "price_asc";

  // 상품 필터링
  const filteredProducts = filterProducts(items, { search, category1, category2, sort });

  // 페이지네이션
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const products = filteredProducts.slice(startIndex, endIndex);
  const totalCount = filteredProducts.length;

  // 카테고리 추출
  const categories = getUniqueCategories(items);

  return {
    products,
    categories,
    totalCount,
    filteredCount: filteredProducts.length,
    totalItems: items.length,
  };
}

/**
 * 홈페이지 데이터를 스토어에 디스패치
 * @param {Object} productStore - productStore 인스턴스
 * @param {Object} data - prefetchHomePageData의 반환값
 * @param {Object} options - 추가 옵션 (error 등)
 */
export function dispatchHomePageData(productStore, data, options = {}) {
  const { products, categories, totalCount } = data;
  const { error = null } = options;

  productStore.dispatch({
    type: PRODUCT_ACTIONS.SETUP,
    payload: {
      products,
      categories,
      totalCount,
      loading: false,
      status: error ? "error" : "done",
      error,
    },
  });
}
