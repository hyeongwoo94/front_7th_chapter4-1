import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sirv from "sirv";
import { filterProducts } from "./src/utils/productFilter.js";
import { getUniqueCategories } from "./src/utils/categoryUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prod = process.env.NODE_ENV === "production";
const port = process.env.PORT || 5174;
const base = process.env.BASE || (prod ? "/front_7th_chapter4-1/vanilla/" : "/");

const app = express();

// HTML 템플릿 읽기
const templatePath = path.join(__dirname, "index.html");
const template = fs.readFileSync(templatePath, "utf-8");

// SSR 렌더링 함수 import (비동기 초기화)
let render;
async function initializeRender() {
  if (prod) {
    // 프로덕션: 빌드된 서버 모듈 사용
    const serverModule = await import("./dist/vanilla-ssr/main-server.js");
    render = serverModule.render;
  } else {
    // 개발: 소스 파일 직접 import
    const serverModule = await import("./src/main-server.js");
    render = serverModule.render;
  }
}

// API는 app.use() 미들웨어에서 직접 처리하므로 별도의 라우트 등록이 필요 없습니다.
// 이전에 사용하던 setupAPIRoutes() 함수는 제거되었습니다.

// Express JSON 파서 미들웨어 추가 (API 요청 처리 전에)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 서빙 설정 (SSR 미들웨어보다 먼저 등록)
if (prod) {
  // 프로덕션: 빌드된 파일 서빙
  const distPath = path.join(__dirname, "dist/vanilla");
  // 디렉토리가 존재하는 경우에만 정적 파일 서빙
  if (fs.existsSync(distPath)) {
    app.use(
      base,
      sirv(distPath, {
        dev: false,
        onNoMatch: (req, res, next) => next(), // 파일이 없으면 다음 미들웨어로
      }),
    );
  } else {
    console.warn(`⚠️  프로덕션 모드이지만 빌드 디렉토리가 없습니다: ${distPath}`);
    console.warn("   개발 모드로 정적 파일을 서빙합니다.");
    // 개발 모드로 폴백
    app.use(
      "/src",
      sirv(path.join(__dirname, "src"), {
        dev: true,
        onNoMatch: (req, res, next) => next(),
      }),
    );
    app.use(
      "/public",
      sirv(path.join(__dirname, "public"), {
        dev: true,
        onNoMatch: (req, res, next) => next(),
      }),
    );
  }
} else {
  // 개발: 정적 파일 서빙 (src, public 폴더)
  app.use(
    "/src",
    sirv(path.join(__dirname, "src"), {
      dev: true,
      onNoMatch: (req, res, next) => next(), // 파일이 없으면 다음 미들웨어로
    }),
  );
  app.use(
    "/public",
    sirv(path.join(__dirname, "public"), {
      dev: true,
      onNoMatch: (req, res, next) => next(), // 파일이 없으면 다음 미들웨어로
    }),
  );
}

// 모든 라우트에 대해 SSR 처리 (Express 5.x 호환)
// 정적 파일이 처리되지 않은 경우에만 SSR 실행
app.use(async (req, res, next) => {
  // 디버깅: 모든 요청 로그
  console.log(`[Server] 요청 받음: ${req.method} ${req.path} (query: ${JSON.stringify(req.query)})`);

  // 정적 파일 요청은 건너뛰기
  if (req.path.startsWith("/src/") || req.path.startsWith("/public/")) {
    return next();
  }

  // API 요청을 직접 처리 (Express 라우트 등록 순서 문제 우회)
  // 명세서에 따르면 /api/ prefix 없이 /products, /categories 사용
  // 중요: 정확히 일치하는 경로만 처리 (SSR 라우트와 충돌 방지)
  const isApiRequest =
    (req.path === "/products" || req.path.startsWith("/products/") || req.path === "/categories") &&
    req.method === "GET";

  if (isApiRequest) {
    console.log(`[Server] API 요청 감지: ${req.method} ${req.path}`);
    try {
      // items.json 로드 (캐싱)
      if (!global.apiItems) {
        const { default: items } = await import("./src/mocks/items.json", { with: { type: "json" } });
        global.apiItems = items;
      }
      const items = global.apiItems;

      const delay = async () => await new Promise((resolve) => setTimeout(resolve, 200));

      // /products 처리
      if (req.path === "/products" && req.method === "GET") {
        console.log("[API Middleware] /products 요청 받음", req.query);
        await delay();
        const page = parseInt(req.query.page ?? req.query.current) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || "";
        const category1 = req.query.category1 || "";
        const category2 = req.query.category2 || "";
        const sort = req.query.sort || "price_asc";

        const filteredProducts = filterProducts(items, { search, category1, category2, sort });
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

        const responseData = {
          products: paginatedProducts,
          pagination: {
            page,
            limit,
            total: filteredProducts.length,
            totalPages: Math.ceil(filteredProducts.length / limit),
            hasNext: endIndex < filteredProducts.length,
            hasPrev: page > 1,
          },
          filters: { search, category1, category2, sort },
        };

        console.log("[API Middleware] /products 응답 전송:", JSON.stringify(responseData).substring(0, 100) + "...");
        res.setHeader("Content-Type", "application/json");
        return res.json(responseData);
      }

      // /products/:id 처리
      const productIdMatch = req.path.match(/^\/products\/([^/]+)$/);
      if (productIdMatch && req.method === "GET") {
        const productId = productIdMatch[1];
        console.log("[API Middleware] /products/:id 요청 받음", productId);
        const product = items.find((item) => item.productId === productId);

        if (!product) {
          res.setHeader("Content-Type", "application/json");
          return res.status(404).json({ error: "Product not found" });
        }

        const detailProduct = {
          ...product,
          description: `${product.title}에 대한 상세 설명입니다. ${product.brand} 브랜드의 우수한 품질을 자랑하는 상품으로, 고객 만족도가 높은 제품입니다.`,
          rating: Math.floor(Math.random() * 2) + 4,
          reviewCount: Math.floor(Math.random() * 1000) + 50,
          stock: Math.floor(Math.random() * 100) + 10,
          images: [product.image, product.image.replace(".jpg", "_2.jpg"), product.image.replace(".jpg", "_3.jpg")],
        };

        res.setHeader("Content-Type", "application/json");
        return res.json(detailProduct);
      }

      // /categories 처리
      if (req.path === "/categories" && req.method === "GET") {
        console.log("[API Middleware] /categories 요청 받음");
        await delay();
        const categories = getUniqueCategories(items);
        res.setHeader("Content-Type", "application/json");
        return res.json(categories);
      }

      // 알 수 없는 API 엔드포인트
      res.setHeader("Content-Type", "application/json");
      return res.status(404).json({ error: "API endpoint not found", path: req.path });
    } catch (error) {
      console.error("[API Middleware] 오류:", error);
      return res.status(500).json({ error: "Internal server error", message: error.message });
    }
  }

  // render 함수가 아직 초기화되지 않았으면 초기화
  if (!render) {
    await initializeRender();
  }

  // 타임아웃 방지: render 함수에 타임아웃 설정
  const renderWithTimeout = (url, query) => {
    return Promise.race([
      render(url, query),
      new Promise((_, reject) => setTimeout(() => reject(new Error("SSR 렌더링 타임아웃 (10초 초과)")), 10000)),
    ]);
  };

  try {
    // URL과 쿼리 파라미터 추출
    const url = req.url.split("?")[0];
    const query = req.query;

    console.log(`[SSR] 요청 받음: ${req.method} ${req.url}`);

    // 서버에서 렌더링 (타임아웃 적용)
    const renderStartTime = Date.now();
    const { html: appHtml, initialState, title = "쇼핑몰" } = await renderWithTimeout(url, query);
    const renderDuration = Date.now() - renderStartTime;
    console.log(`[SSR] 렌더링 완료 (${renderDuration}ms)`);

    // HTML 템플릿에 삽입
    const initialStateJson = JSON.stringify(initialState || {});
    const initialStateScript = `<script>window.__INITIAL_DATA__ = ${initialStateJson};</script>`;

    // 디버깅: initialState 확인 및 검증
    if (!initialState || !initialState.productStore) {
      console.warn(`[SSR] 경고: initialState가 비어있거나 productStore가 없습니다.`);
      console.warn(`  - initialState:`, initialState);
    } else {
      console.log(`[SSR] initialState 주입 완료 (productStore 포함)`);
      const productStore = initialState.productStore;
      if (productStore.products && productStore.products.length > 0) {
        console.log(`[SSR] ✅ products 배열 포함됨: ${productStore.products.length}개`);
        console.log(`[SSR] 첫 번째 상품: ${productStore.products[0]?.title || "없음"}`);
      } else {
        console.error(`[SSR] ❌ products 배열이 비어있습니다.`);
      }
    }

    // JSON에 "products":[...] 형식이 포함되어 있는지 확인
    if (!initialStateJson.includes('"products":[')) {
      console.error(`[SSR] ❌ 오류: JSON에 "products":[...] 형식이 포함되지 않습니다.`);
      console.error(`[SSR] JSON 길이: ${initialStateJson.length}`);
      console.error(`[SSR] JSON 시작 부분: ${initialStateJson.substring(0, 200)}`);
      if (initialState?.productStore) {
        console.error(`[SSR] productStore 키: ${Object.keys(initialState.productStore).join(", ")}`);
      }
    } else {
      console.log(`[SSR] ✅ JSON에 "products":[...] 형식 포함됨`);
      // "products":[...] 위치 찾기
      const productsIndex = initialStateJson.indexOf('"products":[');
      console.log(`[SSR] "products":[...] 위치: ${productsIndex}`);
      console.log(
        `[SSR] "products":[...] 주변 텍스트: ${initialStateJson.substring(Math.max(0, productsIndex - 50), Math.min(initialStateJson.length, productsIndex + 200))}`,
      );
    }

    const html = template
      .replace("<!--app-html-->", appHtml || '<div id="root"></div>')
      .replace("<!--app-head-->", initialStateScript)
      .replace("<!--app-title-->", title);

    // JavaScript가 비활성화된 환경에서도 load 이벤트가 발생하도록
    // Content-Type과 Content-Length 헤더를 명시적으로 설정하여
    // 브라우저가 응답이 완료되었음을 알 수 있도록 함
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(html, "utf-8"));
    // Connection: close 헤더를 설정하여 응답이 완료되었음을 명시
    res.setHeader("Connection", "close");

    console.log(`[SSR] 응답 전송 시작 (HTML 길이: ${html.length} bytes)`);
    res.send(html);
    console.log(`[SSR] 응답 전송 완료`);
  } catch (error) {
    console.error("[SSR] 렌더링 오류:", error);
    if (error.stack) {
      console.error("[SSR] 에러 스택:", error.stack);
    }

    // 에러 응답도 헤더 설정하여 타임아웃 방지
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>서버 오류</title>
        </head>
        <body>
          <h1>서버 오류가 발생했습니다</h1>
          <p>${error.message}</p>
        </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(errorHtml, "utf-8"));
    res.setHeader("Connection", "close");
    res.status(500).send(errorHtml);
  }
});

// 서버 시작 전에 render 함수 초기화
// API는 app.use() 미들웨어에서 직접 처리하므로 별도 초기화가 필요 없습니다.
initializeRender()
  .then(() => {
    // Start http server
    app.listen(port, () => {
      console.log(`\n🚀 Vanilla SSR Server started at http://localhost:${port}`);
      console.log(`📡 API routes (미들웨어에서 처리):`);
      console.log(`   - GET /products`);
      console.log(`   - GET /products/:id`);
      console.log(`   - GET /categories`);
      console.log(`\n📋 테스트 방법:`);
      console.log(`   1. 브라우저에서: http://localhost:${port}/products`);
      console.log(`   2. PowerShell: Invoke-WebRequest -Uri "http://localhost:${port}/products"`);
      console.log(`   3. 홈페이지: http://localhost:${port}/\n`);
    });
  })
  .catch((error) => {
    console.error("서버 초기화 실패:", error);
    process.exit(1);
  });
