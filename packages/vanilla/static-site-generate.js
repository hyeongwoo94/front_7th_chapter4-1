import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// SSG 빌드 환경 변수 설정
process.env.SSG_BUILD = "true";

// MSW 서버 초기화 (SSG 빌드 타임에 fetch를 intercept하기 위해)
import { server } from "./src/mocks/node.js";
server.listen({ onUnhandledRequest: "bypass" });

// handlers 로직 직접 import (SSG 빌드에서 사용)
import items from "./src/mocks/items.json" with { type: "json" };

import { render } from "./src/main-server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HTML 템플릿 경로
const templatePath = path.join(__dirname, "index.html");
// 출력 디렉토리
const outputDir = path.join(__dirname, "../../dist/vanilla");

/**
 * SSG: 정적 사이트 생성
 * 홈페이지와 모든 상품 상세 페이지를 빌드 타임에 생성
 */
async function generateStaticSite() {
  console.log("🚀 SSG 빌드 시작...");

  // 출력 디렉토리 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // HTML 템플릿 읽기
  const template = fs.readFileSync(templatePath, "utf-8");

  try {
    // 1. 홈페이지 생성
    console.log("📄 홈페이지 생성 중...");
    const homeResult = await render("/", {});
    const homeHtml = template
      .replace("<!--app-html-->", homeResult.html || '<div id="root"></div>')
      .replace(
        "<!--app-head-->",
        `<script>window.__INITIAL_DATA__ = ${JSON.stringify(homeResult.initialState || {})};</script>`,
      );

    fs.writeFileSync(path.join(outputDir, "index.html"), homeHtml);
    console.log("✅ 홈페이지 생성 완료");

    // 2. 모든 상품 목록 가져오기
    // SSG 빌드에서는 handlers 로직을 직접 사용
    console.log("📦 상품 목록 가져오는 중...");

    // handlers.js의 필터링 로직 직접 사용
    function filterProducts(products, query) {
      let filtered = [...products];
      if (query.search) {
        const searchTerm = query.search.toLowerCase();
        filtered = filtered.filter(
          (item) => item.title.toLowerCase().includes(searchTerm) || item.brand.toLowerCase().includes(searchTerm),
        );
      }
      if (query.category1) {
        filtered = filtered.filter((item) => item.category1 === query.category1);
      }
      if (query.category2) {
        filtered = filtered.filter((item) => item.category2 === query.category2);
      }
      if (query.sort) {
        switch (query.sort) {
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
      }
      return filtered;
    }

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
        const productHtml = template
          .replace("<!--app-html-->", productResult.html || '<div id="root"></div>')
          .replace(
            "<!--app-head-->",
            `<script>window.__INITIAL_DATA__ = ${JSON.stringify(productResult.initialState || {})};</script>`,
          );

        // index.html로 저장 (깔끔한 URL을 위해)
        fs.writeFileSync(path.join(productDir, "index.html"), productHtml);
        successCount++;
      } catch (error) {
        console.error(`❌ 상품 ${product.productId} 페이지 생성 실패:`, error.message);
        errorCount++;
      }
    }

    console.log(`✅ 상품 상세 페이지 생성 완료: ${successCount}개 성공, ${errorCount}개 실패`);

    // 4. 404 페이지 생성 (선택사항)
    console.log("📄 404 페이지 생성 중...");
    const notFoundResult = await render("/404", {});
    const notFoundHtml = template
      .replace("<!--app-html-->", notFoundResult.html || '<div id="root"></div>')
      .replace(
        "<!--app-head-->",
        `<script>window.__INITIAL_DATA__ = ${JSON.stringify(notFoundResult.initialState || {})};</script>`,
      );

    fs.writeFileSync(path.join(outputDir, "404.html"), notFoundHtml);
    console.log("✅ 404 페이지 생성 완료");

    console.log("🎉 SSG 빌드 완료!");
    console.log(`📁 출력 디렉토리: ${outputDir}`);
  } catch (error) {
    console.error("❌ SSG 빌드 실패:", error);
    process.exit(1);
  }
}

// 실행
generateStaticSite();
