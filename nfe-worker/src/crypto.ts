/**
 * Modulo de criptografia para certificados
 * Usa AES-256-GCM para criptografar/descriptografar
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Criptografa dados usando AES-256-GCM
 * @param plaintext Texto a ser criptografado
 * @param key Chave de 32 bytes (256 bits)
 * @returns String no formato "iv:ciphertext:tag" em base64
 */
export function encrypt(plaintext: string, key: string): string {
  // Garantir que a chave tenha 32 bytes
  const keyBuffer = Buffer.alloc(32);
  Buffer.from(key).copy(keyBuffer);

  // Gerar IV aleatorio
  const iv = crypto.randomBytes(IV_LENGTH);

  // Criar cipher
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  // Criptografar
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // Obter tag de autenticacao
  const tag = cipher.getAuthTag();

  // Concatenar iv:ciphertext:tag e converter para base64
  const result = Buffer.concat([iv, encrypted, tag]);
  return result.toString('base64');
}

/**
 * Descriptografa dados criptografados com AES-256-GCM
 * @param encrypted String no formato "iv:ciphertext:tag" em base64
 * @param key Chave de 32 bytes (256 bits)
 * @returns Texto descriptografado
 */
export function decrypt(encrypted: string, key: string): string {
  // Garantir que a chave tenha 32 bytes
  const keyBuffer = Buffer.alloc(32);
  Buffer.from(key).copy(keyBuffer);

  // Decodificar base64
  const data = Buffer.from(encrypted, 'base64');

  // Extrair IV, ciphertext e tag
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(data.length - TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);

  // Criar decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);

  // Descriptografar
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Gera uma chave aleatoria de 32 bytes
 * @returns Chave em formato hexadecimal
 */
export function generateKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
