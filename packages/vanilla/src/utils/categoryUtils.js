/**
 * 카테고리 유틸리티 함수
 * SSR/SSG/API 핸들러에서 공통으로 사용
 */

/**
 * 상품 목록에서 고유한 카테고리 구조 추출
 * @param {Array} items - 상품 목록 배열
 * @returns {Object} 카테고리 구조 객체
 * @example
 * {
 *   "생활/건강": {
 *     "생활용품": {},
 *     "주방용품": {}
 *   },
 *   "디지털/가전": {
 *     "태블릿PC": {},
 *     "노트북": {}
 *   }
 * }
 */
export function getUniqueCategories(items) {
  const categories = {};

  items.forEach((item) => {
    const cat1 = item.category1;
    const cat2 = item.category2;

    if (!categories[cat1]) {
      categories[cat1] = {};
    }
    if (cat2 && !categories[cat1][cat2]) {
      categories[cat1][cat2] = {};
    }
  });

  return categories;
}
