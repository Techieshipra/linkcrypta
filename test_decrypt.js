const crypto = require('crypto');
const salt = Buffer.from("salt1234salt1234", 'utf8');
const key = crypto.pbkdf2Sync("password123", salt, 210000, 32, 'sha256');

// Wait for Dart to output `n` and `c`, and pass them as args
const nBase64 = process.argv[2];
const cBase64 = process.argv[3];

const iv = Buffer.from(nBase64, 'base64');
const ciphertextAndTag = Buffer.from(cBase64, 'base64');

const ciphertext = ciphertextAndTag.subarray(0, ciphertextAndTag.length - 16);
const authTag = ciphertextAndTag.subarray(ciphertextAndTag.length - 16);

const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);
let decrypted = decipher.update(ciphertext, null, 'utf8');
decrypted += decipher.final('utf8');

console.log('Decrypted:', decrypted);
