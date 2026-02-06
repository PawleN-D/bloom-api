import { generateSubdomain, isValidSubdomain } from '../src/shared/utils/subdomain';

describe('subdomain utilities', () => {
  test('generateSubdomain generates expected slug', () => {
    expect(generateSubdomain('CareWell Dublin')).toBe('carewell-dublin');
    expect(generateSubdomain("O'Brien Care")).toBe('obrien-care');
  });

  test('isValidSubdomain validates rules and reserved list', () => {
    expect(isValidSubdomain('company1')).toBe(true);
    expect(isValidSubdomain('www')).toBe(false);
    expect(isValidSubdomain('Company1')).toBe(false);
  });
});
