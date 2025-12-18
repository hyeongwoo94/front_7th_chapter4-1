import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sirv from "sirv";
import { injectIntoTemplate } from "./src/utils/htmlUtils.js";
// TypeScript 파일을 직접 import할 수 없으므로, main-server.tsx에서 export한 함수 사용
// 또는 JavaScript로 변환된 파일 사용
// 일단 server.js에서 직접 구현
async function filterProducts(products, query = {}) {
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

function getUniqueCategories(items) {
  const categories = {};

  items.forEach((item) => {
    const cat1 = item.category1;
    const cat2 = item.category2;

    if (cat1 && !categories[cat1]) {
      categories[cat1] = {};
    }
    if (cat1 && cat2 && !categories[cat1][cat2]) {
      categories[cat1][cat2] = {};
    }
  });

  return categories;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prod = process.env.NODE_ENV === "production";
const port = process.env.PORT || 5176;
const base = process.env.BASE || (prod ? "/front_7th_chapter4-1/react/" : "/");

const app = express();

// HTML 템플릿 읽기 함수 (매 요청마다 최신 템플릿 보장)
function getTemplate() {
  let templatePath;
  if (prod) {
    // 프로덕션: 빌드된 템플릿 우선, 없으면 원본 사용
    const builtTemplatePath = path.join(__dirname, "dist/react/index.html");
    if (fs.existsSync(builtTemplatePath)) {
      templatePath = builtTemplatePath;
    } else {
      templatePath = path.join(__dirname, "index.html");
    }
  } else {
    // 개발: 원본 템플릿 사용
    templatePath = path.join(__dirname, "index.html");
  }
  // 매 요청마다 템플릿을 다시 읽어서 최신 상태 보장
  return fs.readFileSync(templatePath, "utf-8");
}

// SSR 렌더링 함수 import (비동기 초기화)
let render;
async function initializeRender() {
  try {
    // 빌드된 JavaScript 파일 사용 (개발/프로덕션 모두)
    const buildPath = path.join(__dirname, "dist/react-ssr/main-server.js");
    if (fs.existsSync(buildPath)) {
      const serverModule = await import("./dist/react-ssr/main-server.js");
      render = serverModule.render;
    } else {
      // 빌드된 파일이 없으면 소스 파일 시도 (tsx로 실행해야 함)
      console.warn("⚠️  빌드된 파일이 없습니다. 빌드를 실행하세요: pnpm run build:server");
      const serverModule = await import("./src/main-server.tsx");
      render = serverModule.render;
    }
  } catch (error) {
    console.error("render 함수 초기화 실패:", error);
    console.error("TypeScript 파일을 직접 import하려면 tsx를 사용하거나 빌드된 파일을 사용하세요.");
    throw error;
  }
}

// Express JSON 파서 미들웨어 추가 (API 요청 처리 전에)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (prod) {
  // 프로덕션: 빌드된 파일 서빙 (assets 폴더만)
  const distPath = path.join(__dirname, "dist/react");
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
  // HTML 파일은 SSR로 처리해야 하므로 제외
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
  // Vite HMR 클라이언트 스크립트 처리
  app.use(
    "/@vite",
    sirv(path.join(__dirname, "node_modules/vite/dist/client"), {
      dev: true,
      onNoMatch: (req, res, next) => next(),
    }),
  );
  // Vite React Refresh 처리
  app.use(
    "/@react-refresh",
    sirv(path.join(__dirname, "node_modules/@vitejs/plugin-react/dist/client.js"), {
      dev: true,
      onNoMatch: (req, res, next) => next(),
    }),
  );
}

// 모든 라우트에 대해 SSR 처리
const ssrMiddleware = async (req, res, next) => {
  // 디버깅: 요청 로그
  console.log(`[SSR] ${req.method} ${req.path} - ${req.originalUrl}`);

  // 정적 파일 요청은 건너뛰기 (개발 모드용)
  if (req.path.startsWith("/src/") || req.path.startsWith("/public/") || req.path.startsWith("/@")) {
    return next();
  }

  // 프로덕션 모드: /assets 요청은 이미 정적 파일 미들웨어에서 처리됨
  if (prod && req.path.startsWith("/assets/")) {
    return next();
  }

  // Vite HMR 요청은 건너뛰기
  if (req.path.startsWith("/@vite/") || req.path.startsWith("/@fs/")) {
    return next();
  }

  // API 요청을 직접 처리
  const isApiRequest =
    (req.path === "/api/products" || req.path.startsWith("/api/products/") || req.path === "/api/categories") &&
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

      // /api/products 처리
      if (req.path === "/api/products" && req.method === "GET") {
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

        res.json(responseData);
        return;
      }

      // /api/products/:id 처리
      if (req.path.startsWith("/api/products/") && req.method === "GET") {
        await delay();
        const productId = req.path.split("/api/products/")[1];
        const product = items.find((item) => item.productId === productId);

        if (product) {
          res.json(product);
        } else {
          res.status(404).json({ error: "상품을 찾을 수 없습니다." });
        }
        return;
      }

      // /api/categories 처리
      if (req.path === "/api/categories" && req.method === "GET") {
        await delay();
        const categories = getUniqueCategories(items);
        res.json(categories);
        return;
      }
    } catch (error) {
      console.error("API 처리 오류:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
      return;
    }
  }

  // SSR 렌더링
  if (!render) {
    await initializeRender();
  }

  try {
    // URL 파싱
    const url = req.originalUrl?.split("?")[0] || req.url.split("?")[0];
    const query = req.query;

    console.log(`[SSR] render 호출: url=${url}, query=`, query);
    // render 함수 호출
    const { html: appHtml, initialState, title } = await render(url, query);
    console.log(`[SSR] render 결과: html 길이=${appHtml?.length || 0}, title=${title}`);

    // 매 요청마다 최신 템플릿 읽기
    const template = getTemplate();

    // 템플릿에 플레이스홀더가 있는지 확인
    if (!template.includes("<!--app-html-->")) {
      const templatePath = prod
        ? fs.existsSync(path.join(__dirname, "dist/react/index.html"))
          ? path.join(__dirname, "dist/react/index.html")
          : path.join(__dirname, "index.html")
        : path.join(__dirname, "index.html");
      throw new Error("템플릿에 <!--app-html--> 플레이스홀더가 없습니다. 템플릿 경로: " + templatePath);
    }

    // 템플릿 디버깅 정보
    console.log(`[SSR] 템플릿 확인:`);
    console.log(`[SSR] - <!--app-html--> 포함:`, template.includes("<!--app-html-->"));
    console.log(`[SSR] - <!--app-head--> 포함:`, template.includes("<!--app-head-->"));
    console.log(`[SSR] - <!--app-title--> 포함:`, template.includes("<!--app-title-->"));
    console.log(`[SSR] - 템플릿 길이:`, template.length);

    // injectIntoTemplate 유틸리티 함수 사용 (모든 플레이스홀더 치환 보장)
    const html = injectIntoTemplate(template, {
      html: appHtml,
      initialState,
      title,
    });

    // 치환 검증: 플레이스홀더가 남아있으면 에러
    if (html.includes("<!--app-html-->") || html.includes("<!--app-head-->") || html.includes("<!--app-title-->")) {
      console.error("[SSR] 플레이스홀더 치환 실패!");
      console.error("[SSR] - <!--app-html--> 남아있음:", html.includes("<!--app-html-->"));
      console.error("[SSR] - <!--app-head--> 남아있음:", html.includes("<!--app-head-->"));
      console.error("[SSR] - <!--app-title--> 남아있음:", html.includes("<!--app-title-->"));
      console.error("[SSR] - 치환 전 템플릿 일부:", template.substring(0, 500));
      console.error("[SSR] - 치환 후 HTML 일부:", html.substring(0, 500));
      throw new Error("플레이스홀더 치환이 완료되지 않았습니다.");
    }

    console.log(`[SSR] HTML 치환 완료`);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    console.error("SSR 렌더링 오류:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>서버 오류</title>
      </head>
      <body>
        <h1>서버 오류가 발생했습니다.</h1>
        <pre>${error.message}</pre>
      </body>
      </html>
    `);
  }
};

// SSR 미들웨어를 정적 파일 서빙보다 먼저 등록 (HTML 파일은 SSR로 처리)
// 프로덕션 모드에서는 base 경로에 SSR 미들웨어 등록
// 개발 모드에서는 루트 경로에 등록
if (prod) {
  app.use(base, ssrMiddleware);
} else {
  app.use(ssrMiddleware);
}

// 서버 시작 전에 render 함수 초기화
initializeRender()
  .then(() => {
    // Start http server
    app.listen(port, () => {
      console.log(`\n🚀 React SSR Server started at http://localhost:${port}${prod ? base : "/"}`);
      console.log(`📡 API routes (미들웨어에서 처리):`);
      console.log(`   - GET /api/products`);
      console.log(`   - GET /api/products/:id`);
      console.log(`   - GET /api/categories`);
      console.log(`\n📋 테스트 방법:`);
      console.log(`   1. 브라우저에서: http://localhost:${port}/`);
      console.log(`   2. 홈페이지: http://localhost:${port}/\n`);
    });
  })
  .catch((error) => {
    console.error("서버 초기화 실패:", error);
    process.exit(1);
  });
