const crypto = require('crypto');
const salt = Buffer.from("salt1234salt1234", 'utf8');
const key = crypto.pbkdf2Sync("password123", salt, 210000, 32, 'sha256');
console.log(key.toString('base64'));
