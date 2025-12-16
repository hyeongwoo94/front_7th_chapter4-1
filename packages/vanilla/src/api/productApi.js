// 서버 사이드에서 사용할 포트 (환경 변수 또는 기본값)
const getBaseUrl = () => {
  // 클라이언트 사이드에서는 항상 상대 경로 사용 (MSW가 intercept)
  if (typeof window !== "undefined") {
    return "";
  }

  // 서버 사이드(SSR)에서는 MSW가 fetch를 intercept하므로 빈 문자열 반환
  // main-server.js에서 initializeMSW()를 호출하여 MSW 서버를 시작하므로,
  // 서버 사이드에서도 MSW가 요청을 처리함
  if (typeof process !== "undefined") {
    // SSG 빌드 타임과 SSR 모두 MSW가 처리
    return ""; // MSW가 intercept하도록 빈 문자열 반환
  }
  return "";
};

export async function getProducts(params = {}) {
  const { limit = 20, search = "", category1 = "", category2 = "", sort = "price_asc" } = params;
  const page = params.current ?? params.page ?? 1;

  const searchParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search }),
    ...(category1 && { category1 }),
    ...(category2 && { category2 }),
    sort,
  });

  const baseUrl = getBaseUrl();
  // URL 생성: 서버 사이드에서는 절대 URL, 클라이언트 사이드에서는 상대 경로
  const url = baseUrl ? `${baseUrl}/products?${searchParams}` : `/products?${searchParams}`; // 클라이언트 사이드: 상대 경로 (MSW가 intercept)

  console.log(`[productApi] getProducts 요청: ${url}`);
  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    console.error(`[productApi] getProducts 오류: ${response.status} ${response.statusText}`, text.substring(0, 200));
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error(`[productApi] getProducts 오류: JSON이 아닌 응답`, text.substring(0, 200));
    throw new Error(`Expected JSON but got ${contentType}`);
  }

  return await response.json();
}

export async function getProduct(productId) {
  const baseUrl = getBaseUrl();
  const url = baseUrl ? `${baseUrl}/products/${productId}` : `/products/${productId}`; // 클라이언트 사이드: 상대 경로 (MSW가 intercept)
  const response = await fetch(url);
  return await response.json();
}

export async function getCategories() {
  const baseUrl = getBaseUrl();
  const url = baseUrl ? `${baseUrl}/categories` : `/categories`; // 클라이언트 사이드: 상대 경로 (MSW가 intercept)
  const response = await fetch(url);
  return await response.json();
}
