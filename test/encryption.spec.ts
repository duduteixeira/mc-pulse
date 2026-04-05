import { encrypt, decrypt, generateEncryptionKey } from '../src/common/utils/encryption.util';

describe('EncryptionUtil', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = generateEncryptionKey();
  });

  it('roundtrip encrypt/decrypt retorna plaintext original', () => {
    const secret = 'super-secret-sfmc-client-secret-xyz-123';
    const enc = encrypt(secret);
    expect(enc).not.toContain(secret);
    const dec = decrypt(enc);
    expect(dec).toBe(secret);
  });

  it('duas cifras do mesmo plaintext diferem (IV aleatório)', () => {
    const a = encrypt('hello');
    const b = encrypt('hello');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('hello');
    expect(decrypt(b)).toBe('hello');
  });

  it('decrypt falha em payload adulterado', () => {
    const enc = encrypt('payload');
    const parts = enc.split(':');
    parts[2] = 'deadbeef';
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('falha quando ENCRYPTION_KEY ausente', () => {
    const original = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('x')).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = original;
  });
});
