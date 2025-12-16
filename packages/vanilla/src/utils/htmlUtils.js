/**
 * HTML 템플릿 유틸리티
 * SSR/SSG에서 공통으로 사용
 */

/**
 * HTML 템플릿에 렌더링 결과 삽입
 * @param {string} template - HTML 템플릿
 * @param {Object} options - 삽입할 데이터
 * @param {string} options.html - 렌더링된 HTML
 * @param {Object} options.initialState - 초기 상태 데이터
 * @param {string} options.title - 페이지 타이틀
 * @returns {string} 완성된 HTML
 */
export function injectIntoTemplate(template, { html, initialState, title }) {
  const initialStateScript = `<script>window.__INITIAL_DATA__ = ${JSON.stringify(initialState || {})};</script>`;
  return template
    .replace("<!--app-html-->", html || '<div id="root"></div>')
    .replace("<!--app-head-->", initialStateScript)
    .replace("<!--app-title-->", title || "쇼핑몰");
}
