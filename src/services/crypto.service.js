const crypto = require('crypto');
const config = require('../config/env');

// Algoritmo de Cifrado Estándar OWASP / NIST
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Normaliza la clave de 32 bytes para AES-256
 */
function getKey() {
  const keyBuffer = Buffer.from(config.ENCRYPTION_KEY, 'hex');
  if (keyBuffer.length === 32) {
    return keyBuffer;
  }
  // Si no viene en hex de 32 bytes, derivar con SHA-256
  return crypto.createHash('sha256').update(String(config.ENCRYPTION_KEY)).digest();
}

/**
 * Cifra un texto plano utilizando AES-256-GCM.
 * Retorna un string compuesto: iv:tag:ciphertext en formato hexadecimal.
 */
function encrypt(plainText) {
  if (plainText === null || plainText === undefined || plainText === '') {
    return '';
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(String(plainText), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Descifra una cadena previamente cifrada con AES-256-GCM.
 */
function decrypt(cipherTextWithMeta) {
  if (!cipherTextWithMeta || typeof cipherTextWithMeta !== 'string') {
    return '';
  }

  const parts = cipherTextWithMeta.split(':');
  if (parts.length !== 3) {
    // Si por alguna razón está en texto plano, devolverlo
    return cipherTextWithMeta;
  }

  try {
    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Error al descifrar dato sensible:', error.message);
    return '[DATO PROTEGIDO - ERROR DE DESCIFRADO]';
  }
}

/**
 * Genera un HMAC-SHA256 determinístico (Blind Index).
 * Se utiliza para búsquedas exactas e índices de unicidad en BD sin exponer datos en texto plano.
 */
function hashBlindIndex(data) {
  if (!data) return '';
  const normalized = String(data).trim().toLowerCase();
  return crypto
    .createHmac('sha256', config.HASH_SECRET)
    .update(normalized)
    .digest('hex');
}

/**
 * Enmascara una cédula para visualización parcial segura si se requiere:
 * Ej: '402-1234567-8' -> '402-****567-8'
 */
function maskCedula(cedula) {
  if (!cedula || typeof cedula !== 'string') return '';
  const clean = cedula.trim();
  if (clean.length < 6) return '***';
  return clean.substring(0, 4) + '****' + clean.substring(clean.length - 3);
}

/**
 * Enmascara un teléfono:
 * Ej: '809-555-1234' -> '809-***-1234'
 */
function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const clean = phone.trim();
  if (clean.length < 7) return '***';
  return clean.substring(0, 4) + '***' + clean.substring(clean.length - 4);
}

/**
 * Enmascara un correo electrónico:
 * Ej: 'usuario@ejemplo.com' -> 'u***o@ejemplo.com'
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `*@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

module.exports = {
  encrypt,
  decrypt,
  hashBlindIndex,
  maskCedula,
  maskPhone,
  maskEmail
};
