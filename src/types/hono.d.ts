declare module "hono" {
  export class Hono {
    use(path: string, handler: (c: any, next: () => Promise<void>) => Promise<void> | void): void;
    get(path: string, handler: (c: any) => Promise<Response> | Response): void;
    post(path: string, handler: (c: any) => Promise<Response> | Response): void;
    put(path: string, handler: (c: any) => Promise<Response> | Response): void;
    patch(path: string, handler: (c: any) => Promise<Response> | Response): void;
    delete(path: string, handler: (c: any) => Promise<Response> | Response): void;
    fetch(request: Request, env?: any, executionCtx?: any): Promise<Response>;
  }
}

declare module "hono/cors" {
  export function cors(options?: Record<string, unknown>): (c: any, next: () => Promise<void>) => Promise<void>;
}

declare module "hono/secure-headers" {
  export function secureHeaders(): (c: any, next: () => Promise<void>) => Promise<void>;
}
