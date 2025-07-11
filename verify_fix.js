import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.LICENSE_ENCRYPTION_KEY || 'inventory-license-key-2024';

function decrypt(encryptedText) {
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// License data
const clientId = 'efe2ae66-b484-4923-9e28-5f04df532c0e';
const appId = '0ce1df0ffe4d4ce2634025e956a4f801';
const licenseKey = 'SR2-VRV-ASY-9P7';
const endDate = '2028-07-11T15:11:50.707Z';

// New encrypted mutual key from database
const newEncryptedMutualKey = '7c5d9a8856db7bd3e91e18d64516544471489a990287c1baeca952c785288e59c27d061121cce2c8d85088cb6cf5cb69b34ce12b4a7344a28ea7dfd03a912b82678e3559a774616f34a7fc08bbb8152d';

// Decrypt the mutual key
const mutualKey = decrypt(newEncryptedMutualKey);

// Calculate checksum
const checksumData = clientId + appId + licenseKey + endDate;
const calculatedChecksum = crypto.createHmac('sha256', mutualKey).update(checksumData).digest('hex');

console.log('=== VERIFICATION AFTER FIX ===');
console.log('Decrypted mutual key:', mutualKey);
console.log('Checksum data:', checksumData);
console.log('Calculated checksum:', calculatedChecksum);
console.log('Expected checksum:', 'cab98cbb63bea5d40cb838d3479d54d42081afa6e48a19bf786644e05432e628');
console.log('✅ Checksums match:', calculatedChecksum === 'cab98cbb63bea5d40cb838d3479d54d42081afa6e48a19bf786644e05432e628');