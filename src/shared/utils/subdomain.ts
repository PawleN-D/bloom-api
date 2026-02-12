import { randomUUID } from 'crypto';
import type { Organization } from '@prisma/client';

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'admin',
  'mail',
  'backoffice',
  'dashboard',
  'demo',
  'test',
  'staging',
]);

const SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function normalizeBaseDomain(baseDomain?: string) {
  return (baseDomain || process.env.BASE_DOMAIN || 'bloom.com')
    .toLowerCase()
    .trim();
}

function trimHyphens(value: string) {
  return value.replace(/(^-+|-+$)/g, '');
}

function clampSubdomain(value: string) {
  if (value.length <= 63) {
    return value;
  }
  return trimHyphens(value.slice(0, 63));
}

export function generateSubdomain(organizationName: string): string {
  const normalized = organizationName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  return clampSubdomain(slug);
}

export function isValidSubdomain(subdomain: string): boolean {
  if (!subdomain) return false;
  if (!SUBDOMAIN_REGEX.test(subdomain)) return false;
  if (RESERVED_SUBDOMAINS.has(subdomain)) return false;
  return true;
}

export async function isSubdomainAvailable(
  prisma: any,
  subdomain: string,
  excludeOrgId?: string
): Promise<boolean> {
  const existing = await prisma.organization.findFirst({
    where: {
      subdomain,
      ...(excludeOrgId ? { id: { not: excludeOrgId } } : {}),
    },
    select: { id: true },
  });

  return !existing;
}

export async function generateUniqueSubdomain(
  prisma: any,
  organizationName: string
): Promise<string> {
  let base = generateSubdomain(organizationName);

  if (!base || !isValidSubdomain(base)) {
    base = `org-${generateSubdomain(organizationName)}`;
    base = clampSubdomain(trimHyphens(base));
  }

  if (!base || !isValidSubdomain(base)) {
    base = `org-${randomUUID().slice(0, 6)}`;
  }

  let candidate = base;
  let suffix = 1;

  while (!(await isSubdomainAvailable(prisma, candidate))) {
    suffix += 1;
    const suffixValue = `-${suffix}`;
    const trimmedBase = clampSubdomain(base.slice(0, 63 - suffixValue.length));
    candidate = `${trimmedBase}${suffixValue}`;
  }

  return candidate;
}

export function getOrganizationUrl(subdomain: string, baseDomain?: string): string {
  const domain = normalizeBaseDomain(baseDomain);
  return `https://${subdomain}.${domain}`;
}

export function extractSubdomain(hostname: string, baseDomain?: string): string | null {
  if (!hostname) return null;
  const domain = normalizeBaseDomain(baseDomain);
  const cleanHost = hostname.toLowerCase().split(':')[0];

  if (cleanHost === domain) return null;
  if (!cleanHost.endsWith(`.${domain}`)) return null;

  const subdomain = cleanHost.slice(0, -(domain.length + 1));
  return subdomain || null;
}

export async function getOrganizationBySubdomain(
  prisma: any,
  hostname: string
): Promise<Organization | null> {
  const subdomain = extractSubdomain(hostname);
  if (!subdomain || !isValidSubdomain(subdomain)) {
    return null;
  }

  const organization = await prisma.organization.findUnique({
    where: { subdomain },
  });

  return organization;
}
