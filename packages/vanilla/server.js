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

// 정적 파일 서빙 설정
// 중요: HTML 파일은 SSR로 처리해야 하므로, 정적 파일은 /assets 경로에만 적용
if (prod) {
  // 프로덕션: 빌드된 파일 서빙 (assets 폴더만)
  const distPath = path.join(__dirname, "dist/vanilla");
  if (fs.existsSync(distPath)) {
    // /assets 경로에만 정적 파일 서빙 적용 (HTML 파일 제외)
    app.use(
      base + "assets",
      sirv(path.join(distPath, "assets"), {
        dev: false,
        onNoMatch: (req, res) => res.status(404).end(),
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
const ssrMiddleware = async (req, res, next) => {
  // 정적 파일 요청은 건너뛰기 (개발 모드용)
  if (req.path.startsWith("/src/") || req.path.startsWith("/public/")) {
    return next();
  }

  // 프로덕션 모드: /assets 요청은 이미 정적 파일 미들웨어에서 처리됨
  if (prod && req.path.startsWith("/assets/")) {
    return next();
  }

  // API 요청을 직접 처리 (Express 라우트 등록 순서 문제 우회)
  // 명세서에 따르면 /api/ prefix 없이 /products, /categories 사용
  // 중요: 정확히 일치하는 경로만 처리 (SSR 라우트와 충돌 방지)
  const isApiRequest =
    (req.path === "/products" || req.path.startsWith("/products/") || req.path === "/categories") &&
    req.method === "GET";

  if (isApiRequest) {
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

        res.setHeader("Content-Type", "application/json");
        return res.json(responseData);
      }

      // /products/:id 처리
      const productIdMatch = req.path.match(/^\/products\/([^/]+)$/);
      if (productIdMatch && req.method === "GET") {
        const productId = productIdMatch[1];
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
    // req.originalUrl은 원본 URL (base 경로 포함)
    // req.path는 Express가 파싱한 경로 (쿼리 제외)
    // sirv 미들웨어는 base 경로를 제거하지 않으므로, req.path는 여전히 base 경로를 포함할 수 있음
    // 따라서 원본 URL을 사용하여 base 경로를 포함한 전체 경로를 전달
    const url = req.originalUrl?.split("?")[0] || req.url.split("?")[0];
    const query = req.query;

    // 서버에서 렌더링 (타임아웃 적용)
    const renderResult = await renderWithTimeout(url, query);
    if (!renderResult) {
      throw new Error("render 함수가 결과를 반환하지 않았습니다.");
    }

    const { html: appHtml = "", initialState = {}, title = "쇼핑몰" } = renderResult;

    // appHtml이 비어있으면 기본값 사용
    const finalAppHtml = appHtml && appHtml.trim().length > 0 ? appHtml : '<div id="root"></div>';

    // HTML 템플릿에 삽입
    const initialStateJson = JSON.stringify(initialState);
    const initialStateScript = `<script>window.__INITIAL_DATA__ = ${initialStateJson};</script>`;

    // 템플릿 치환 (플레이스홀더가 있는지 확인 후 치환)
    let html = template;
    if (!html.includes("<!--app-html-->")) {
      throw new Error("템플릿에 <!--app-html--> 플레이스홀더가 없습니다. 템플릿 경로: " + templatePath);
    }
    html = html.replace("<!--app-html-->", finalAppHtml);
    html = html.replace("<!--app-head-->", initialStateScript);
    html = html.replace("<!--app-title-->", title);

    // JavaScript가 비활성화된 환경에서도 load 이벤트가 발생하도록
    // Content-Type과 Content-Length 헤더를 명시적으로 설정하여
    // 브라우저가 응답이 완료되었음을 알 수 있도록 함
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(html, "utf-8"));
    // Connection: close 헤더를 설정하여 응답이 완료되었음을 명시
    res.setHeader("Connection", "close");

    res.send(html);
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
};

// 프로덕션 모드에서는 base 경로에 SSR 미들웨어 등록
// 개발 모드에서는 루트 경로에 등록
if (prod) {
  app.use(base, ssrMiddleware);
} else {
  app.use(ssrMiddleware);
}

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
