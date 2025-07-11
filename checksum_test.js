import crypto from 'crypto';

// Current license data
const clientId = 'efe2ae66-b484-4923-9e28-5f04df532c0e';
const appId = '0ce1df0ffe4d4ce2634025e956a4f801';
const licenseKey = 'SR2-VRV-ASY-9P7';
const endDate = '2028-07-11T15:11:50.707Z';

// Test with correct mutual key from the file
const correctMutualKey = '81ddea72a1617fef6e135e492bee179ee1f2ca6b19fc33f750764f151c90e0cf';

// Calculate checksum with correct data
const checksumData = clientId + appId + licenseKey + endDate;
const calculatedChecksum = crypto.createHmac('sha256', correctMutualKey).update(checksumData).digest('hex');

console.log('=== CHECKSUM VERIFICATION ===');
console.log('Client ID:', clientId);
console.log('App ID:', appId);
console.log('License Key:', licenseKey);
console.log('End Date:', endDate);
console.log('Mutual Key:', correctMutualKey);
console.log('Checksum Data:', checksumData);
console.log('Calculated Checksum:', calculatedChecksum);
console.log('Expected Checksum:', 'cab98cbb63bea5d40cb838d3479d54d42081afa6e48a19bf786644e05432e628');
console.log('Match:', calculatedChecksum === 'cab98cbb63bea5d40cb838d3479d54d42081afa6e48a19bf786644e05432e628');