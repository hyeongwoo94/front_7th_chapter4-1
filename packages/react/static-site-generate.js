import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { injectIntoTemplate } from "./src/utils/htmlUtils.js";

// SSG 빌드 환경 변수 설정
process.env.SSG_BUILD = "true";

// MSW 서버 초기화 (SSG 빌드 타임에 fetch를 intercept하기 위해)
import { server } from "./src/mocks/node.js";
server.listen({ onUnhandledRequest: "bypass" });

// 상품 데이터 및 유틸리티 import
import items from "./src/mocks/items.json" with { type: "json" };
import { render } from "./dist/react-ssr/main-server.js";

// SSG 빌드 시 global.apiItems 설정 (main-server.tsx에서 사용)
global.apiItems = items;

// filterProducts 함수 (main-server.tsx와 동일한 로직)
function filterProducts(products, query = {}) {
  const { search = "", category1 = "", category2 = "", sort = "price_asc" } = query;
  let filtered = [...products];

  if (search) {
    const searchTerm = search.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.title.toLowerCase().includes(searchTerm) || (item.brand && item.brand.toLowerCase().includes(searchTerm)),
    );
  }

  if (category1) {
    filtered = filtered.filter((item) => item.category1 === category1);
  }
  if (category2) {
    filtered = filtered.filter((item) => item.category2 === category2);
  }

  switch (sort) {
    case "price_asc":
      filtered.sort((a, b) => parseInt(a.lprice) - parseInt(b.lprice));
      break;
    case "price_desc":
      filtered.sort((a, b) => parseInt(b.lprice) - parseInt(a.lprice));
      break;
    case "name_asc":
      filtered.sort((a, b) => a.title.localeCompare(b.title, "ko"));
      break;
    case "name_desc":
      filtered.sort((a, b) => b.title.localeCompare(a.title, "ko"));
      break;
    default:
      filtered.sort((a, b) => parseInt(a.lprice) - parseInt(b.lprice));
  }

  return filtered;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HTML 템플릿 경로
const templatePath = path.join(__dirname, "index.html");
// 출력 디렉토리
const outputDir = path.join(__dirname, "../../dist/react");

/**
 * SSG: 정적 사이트 생성
 * 홈페이지와 모든 상품 상세 페이지를 빌드 타임에 생성
 */
async function generateStaticSite() {
  console.log("🚀 React SSG 빌드 시작...");

  // 출력 디렉토리 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 빌드된 HTML 템플릿 읽기 (Vite가 번들된 스크립트 경로로 업데이트한 것)
  const builtTemplatePath = path.join(outputDir, "index.html");
  let template;
  if (fs.existsSync(builtTemplatePath)) {
    template = fs.readFileSync(builtTemplatePath, "utf-8");
    console.log("✅ 빌드된 HTML 템플릿 사용");
  } else {
    // 빌드된 템플릿이 없으면 원본 사용 (fallback)
    template = fs.readFileSync(templatePath, "utf-8");
    console.warn("⚠️  빌드된 HTML 템플릿을 찾을 수 없어 원본 템플릿 사용");
  }

  try {
    // 1. 홈페이지 생성
    console.log("📄 홈페이지 생성 중...");
    const homeResult = await render("/", {});
    const homeHtml = injectIntoTemplate(template, {
      html: homeResult.html,
      initialState: homeResult.initialState,
      title: homeResult.title || "쇼핑몰 - 홈",
    });
    fs.writeFileSync(path.join(outputDir, "index.html"), homeHtml);
    console.log("✅ 홈페이지 생성 완료");

    // 2. 모든 상품 목록 가져오기
    console.log("📦 상품 목록 가져오는 중...");
    const allProducts = filterProducts(items, { sort: "price_asc" });
    console.log(`✅ ${allProducts.length}개의 상품 발견`);

    // 3. 각 상품 상세 페이지 생성
    console.log("📄 상품 상세 페이지 생성 중...");
    let successCount = 0;
    let errorCount = 0;

    for (const product of allProducts) {
      try {
        const productId = product.productId;
        const productResult = await render(`/product/${productId}/`, {});

        // 상품 상세 페이지 디렉토리 생성
        const productDir = path.join(outputDir, "product", productId.toString());
        fs.mkdirSync(productDir, { recursive: true });

        // HTML 생성
        const productHtml = injectIntoTemplate(template, {
          html: productResult.html,
          initialState: productResult.initialState,
          title: productResult.title || "상품 상세 - 쇼핑몰",
        });

        // index.html로 저장 (깔끔한 URL을 위해)
        fs.writeFileSync(path.join(productDir, "index.html"), productHtml);
        successCount++;
      } catch (error) {
        console.error(`❌ 상품 ${product.productId} 페이지 생성 실패:`, error.message);
        if (error.stack) {
          console.error(`   스택:`, error.stack.split("\n").slice(0, 3).join("\n"));
        }
        errorCount++;
      }
    }

    console.log(`✅ 상품 상세 페이지 생성 완료: ${successCount}개 성공, ${errorCount}개 실패`);

    // 4. 404 페이지 생성
    console.log("📄 404 페이지 생성 중...");
    const notFoundResult = await render("/404", {});
    const notFoundHtml = injectIntoTemplate(template, {
      html: notFoundResult.html,
      initialState: notFoundResult.initialState,
      title: notFoundResult.title || "페이지를 찾을 수 없습니다 - 쇼핑몰",
    });
    fs.writeFileSync(path.join(outputDir, "404.html"), notFoundHtml);
    console.log("✅ 404 페이지 생성 완료");

    console.log("🎉 SSG 빌드 완료!");
  } catch (error) {
    console.error("❌ SSG 빌드 실패:", error);
    if (error.stack) {
      console.error("스택:", error.stack);
    }
    process.exit(1);
  } finally {
    // MSW 서버 종료
    server.close();
  }
}

// 실행
generateStaticSite();
