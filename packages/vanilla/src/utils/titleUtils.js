/**
 * 페이지 타이틀 유틸리티
 * SSR/SSG에서 공통으로 사용
 */

/**
 * 라우트 핸들러와 상품 정보를 기반으로 페이지 타이틀 생성
 * @param {string} handler - 라우트 핸들러 (HomePage, ProductDetailPage, NotFoundPage)
 * @param {Object} product - 상품 정보 (ProductDetailPage인 경우)
 * @returns {string} 페이지 타이틀
 */
export function generatePageTitle(handler, product = null) {
  switch (handler) {
    case "HomePage":
      return "쇼핑몰 - 홈";
    case "ProductDetailPage":
      if (product && product.title) {
        return `${product.title} - 쇼핑몰`;
      }
      return "상품 상세 - 쇼핑몰";
    case "NotFoundPage":
      return "페이지를 찾을 수 없습니다 - 쇼핑몰";
    default:
      return "쇼핑몰";
  }
}
