import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.LICENSE_ENCRYPTION_KEY || 'inventory-license-key-2024';

function encrypt(text) {
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText) {
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Correct mutual key from the file
const correctMutualKey = '81ddea72a1617fef6e135e492bee179ee1f2ca6b19fc33f750764f151c90e0cf';

// Test current stored encrypted mutual key
const currentStoredKey = '355c5392c91ea3718068b55e691538f149408b0d5a7843567ff492af0b60c07463ff271c9acb9027eee007040425ae91358819f43a7b1f83c40536f95a92c4bd732cb8a9134c1b776bcaa6c02cf5706d';

console.log('=== MUTUAL KEY ANALYSIS ===');
console.log('Correct mutual key:', correctMutualKey);

try {
  const decryptedStoredKey = decrypt(currentStoredKey);
  console.log('Currently stored key decrypts to:', decryptedStoredKey);
  console.log('Is stored key correct?', decryptedStoredKey === correctMutualKey);
} catch (error) {
  console.log('Error decrypting stored key:', error.message);
}

// Encrypt the correct mutual key
const correctEncryptedKey = encrypt(correctMutualKey);
console.log('Correctly encrypted mutual key:', correctEncryptedKey);

// Test decryption of our new encrypted key
try {
  const testDecryption = decrypt(correctEncryptedKey);
  console.log('Test decryption of new key:', testDecryption);
  console.log('Encryption/decryption works correctly:', testDecryption === correctMutualKey);
} catch (error) {
  console.log('Error in test decryption:', error.message);
}