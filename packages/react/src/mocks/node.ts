import { setupServer } from "msw/node";
import { handlers } from "./handlers.js";

// MSW 서버 설정 (Node.js 환경용)
export const server = setupServer(...handlers);
