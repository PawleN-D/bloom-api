export type FastifySchema = Record<string, unknown>;
export type FastifyRequest = any;
export type FastifyReply = any;

export type RouteHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> | unknown;

export type FastifyInstance = {
  get: (path: string, optsOrHandler: any, maybeHandler?: RouteHandler) => void;
  post: (path: string, optsOrHandler: any, maybeHandler?: RouteHandler) => void;
  put: (path: string, optsOrHandler: any, maybeHandler?: RouteHandler) => void;
  patch: (path: string, optsOrHandler: any, maybeHandler?: RouteHandler) => void;
  delete: (path: string, optsOrHandler: any, maybeHandler?: RouteHandler) => void;
  register: (plugin: (instance: FastifyInstance) => Promise<void> | void, opts?: { prefix?: string }) => Promise<void>;
  addHook: (name: 'onRequest' | 'onResponse', hook: RouteHandler) => void;
};
