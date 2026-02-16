import { FastifyInstance, FastifySchema } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";

const publicRoutes = new Set([
  "/health",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/setup",
  "/api/organizations/by-subdomain/:subdomain",
]);

const openApiAnySchema = {
  oneOf: [
    { type: "object", additionalProperties: true },
    { type: "array", items: { type: "object", additionalProperties: true } },
    { type: "string" },
    { type: "number" },
    { type: "boolean" },
  ],
};

const successEnvelopeSchema = {
  type: "object",
  required: ["data"],
  properties: {
    data: openApiAnySchema,
  },
};

const errorEnvelopeSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    details: { type: "object", additionalProperties: true },
  },
};

type MutableSchema = FastifySchema & Record<string, any>;

const toTitleCase = (value: string) =>
  value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const inferTag = (url: string) => {
  const parts = url.split("/").filter(Boolean);
  if (parts.length === 0) return "System";
  if (parts[0] !== "api") return toTitleCase(parts[0]);
  const apiRoot = parts[1] || "System";
  return toTitleCase(apiRoot);
};

const inferPathParams = (url: string) => {
  const params = url
    .split("/")
    .filter((part) => part.startsWith(":"))
    .map((part) => part.slice(1))
    .filter(Boolean);

  if (!params.length) {
    return undefined;
  }

  const properties = params.reduce<Record<string, unknown>>((acc, name) => {
    acc[name] = { type: "string" };
    return acc;
  }, {});

  return {
    type: "object",
    required: params,
    properties,
  };
};

const inferSummary = (method: string, url: string) => {
  const normalizedPath = url
    .replace(/\/:([^/]+)/g, "/{$1}")
    .replace(/^\/+/, "");
  return `${method.toUpperCase()} ${normalizedPath || "root"}`;
};

const normalizeRouteSchema = (
  url: string,
  method: string,
  schemaInput: MutableSchema | undefined
) => {
  const schema: MutableSchema = { ...(schemaInput || {}) };
  const normalizedMethod = method.toUpperCase();

  if (!schema.tags || schema.tags.length === 0) {
    schema.tags = [inferTag(url)];
  }

  if (!schema.summary) {
    schema.summary = inferSummary(normalizedMethod, url);
  }

  if (!schema.params) {
    const inferredParams = inferPathParams(url);
    if (inferredParams) {
      schema.params = inferredParams;
    }
  }

  if (
    (normalizedMethod === "POST" ||
      normalizedMethod === "PUT" ||
      normalizedMethod === "PATCH") &&
    !schema.body
  ) {
    schema.body = {
      type: "object",
      additionalProperties: true,
    };
  }

  if (
    (normalizedMethod === "GET" || normalizedMethod === "DELETE") &&
    !schema.querystring
  ) {
    schema.querystring = {
      type: "object",
      additionalProperties: true,
    };
  }

  const response: Record<number | string, unknown> = {
    ...(schema.response || {}),
  };
  const successCode = 200;

  if (!response[successCode]) {
    response[successCode] = successEnvelopeSchema;
  }
  if (!response[400]) {
    response[400] = errorEnvelopeSchema;
  }
  if (!response[401]) {
    response[401] = errorEnvelopeSchema;
  }
  if (!response[403]) {
    response[403] = errorEnvelopeSchema;
  }
  if (!response[404]) {
    response[404] = errorEnvelopeSchema;
  }
  if (!response[500]) {
    response[500] = errorEnvelopeSchema;
  }
  schema.response = response;

  if (publicRoutes.has(url)) {
    schema.security = [];
  }

  return schema;
};

export async function setupSwagger(server: FastifyInstance) {
  await server.register(swagger, {
    mode: "dynamic",
    transform: ({ schema, url, route }: any) => {
      const method = Array.isArray(route.method)
        ? route.method[0]
        : route.method;
      return {
        schema: normalizeRouteSchema(url, method || "GET", schema as MutableSchema),
        url,
      };
    },
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "Bloom Care API",
        description: "Multi-tenant care management platform",
        version: "1.0.0",
      },
      servers: [
        { url: "http://localhost:3001", description: "Development" },
        { url: "https://api.bloom.ie", description: "Production" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
        schemas: {
          SuccessEnvelope: successEnvelopeSchema,
          ErrorEnvelope: errorEnvelopeSchema,
        },
      },
      security: [{ bearerAuth: [] }],
    },
  } as any);

  await server.register(swaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
}
