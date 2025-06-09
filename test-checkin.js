import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function testCheckInAPI() {
  const baseUrl = 'http://localhost:5000';
  
  try {
    console.log('Testing Check-In API Functionality...\n');
    
    // Step 1: Login as admin
    console.log('1. Logging in as admin...');
    const loginResponse = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'Sumit1209!'
      }),
      credentials: 'include'
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.statusText}`);
    }
    
    const loginData = await loginResponse.json();
    console.log('✓ Login successful:', loginData.name);
    
    // Extract cookies for subsequent requests
    const cookies = loginResponse.headers.get('set-cookie');
    
    // Step 2: Test data validation with various scenarios
    const testCases = [
      {
        name: 'Valid check-in with all fields',
        data: {
          itemId: 1,
          quantity: 5,
          destinationWarehouseId: 1,
          transactionType: "check-in",
          status: "completed",
          cost: 1500.50,
          requesterId: 2,
          checkInDate: new Date().toISOString()
        },
        shouldPass: true
      },
      {
        name: 'Valid check-in with minimal fields',
        data: {
          itemId: 2,
          quantity: 10,
          destinationWarehouseId: 1,
          transactionType: "check-in",
          status: "completed"
        },
        shouldPass: true
      },
      {
        name: 'Invalid - missing required itemId',
        data: {
          quantity: 5,
          destinationWarehouseId: 1,
          transactionType: "check-in",
          status: "completed"
        },
        shouldPass: false
      },
      {
        name: 'Invalid - negative quantity',
        data: {
          itemId: 1,
          quantity: -5,
          destinationWarehouseId: 1,
          transactionType: "check-in",
          status: "completed"
        },
        shouldPass: false
      }
    ];
    
    console.log('\n2. Testing transaction creation scenarios...');
    
    for (const testCase of testCases) {
      console.log(`\nTesting: ${testCase.name}`);
      
      const response = await fetch(`${baseUrl}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies || ''
        },
        body: JSON.stringify(testCase.data),
        credentials: 'include'
      });
      
      const responseData = await response.text();
      let parsedData;
      try {
        parsedData = JSON.parse(responseData);
      } catch (e) {
        parsedData = responseData;
      }
      
      if (testCase.shouldPass) {
        if (response.ok) {
          console.log('✓ Test passed - transaction created successfully');
          console.log('  Transaction ID:', parsedData.id);
        } else {
          console.log('✗ Test failed - expected success but got error:');
          console.log('  Status:', response.status);
          console.log('  Error:', parsedData);
        }
      } else {
        if (!response.ok) {
          console.log('✓ Test passed - correctly rejected invalid data');
          console.log('  Status:', response.status);
        } else {
          console.log('✗ Test failed - should have been rejected but was accepted');
          console.log('  Response:', parsedData);
        }
      }
    }
    
    // Step 3: Verify inventory updates
    console.log('\n3. Checking inventory updates...');
    const inventoryResponse = await fetch(`${baseUrl}/api/reports/inventory-stock`, {
      headers: {
        'Cookie': cookies || ''
      },
      credentials: 'include'
    });
    
    if (inventoryResponse.ok) {
      const inventory = await inventoryResponse.json();
      console.log('✓ Inventory data retrieved');
      console.log(`  Total inventory records: ${inventory.length}`);
      
      if (inventory.length > 0) {
        console.log('  Sample inventory record:');
        console.log(`    Item: ${inventory[0].item?.name || 'Unknown'}`);
        console.log(`    Quantity: ${inventory[0].quantity}`);
        console.log(`    Warehouse: ${inventory[0].warehouse?.name || 'Unknown'}`);
      }
    } else {
      console.log('✗ Failed to retrieve inventory data');
    }
    
    // Step 4: Test transaction retrieval
    console.log('\n4. Verifying transaction history...');
    const transactionsResponse = await fetch(`${baseUrl}/api/transactions/type/check-in`, {
      headers: {
        'Cookie': cookies || ''
      },
      credentials: 'include'
    });
    
    if (transactionsResponse.ok) {
      const transactions = await transactionsResponse.json();
      console.log('✓ Check-in transactions retrieved');
      console.log(`  Total check-in transactions: ${transactions.length}`);
      
      if (transactions.length > 0) {
        const lastTransaction = transactions[transactions.length - 1];
        console.log('  Latest transaction:');
        console.log(`    Code: ${lastTransaction.transactionCode}`);
        console.log(`    Quantity: ${lastTransaction.quantity}`);
        console.log(`    Cost: ${lastTransaction.cost || 'Not specified'}`);
        console.log(`    Status: ${lastTransaction.status}`);
      }
    } else {
      console.log('✗ Failed to retrieve transaction history');
    }
    
    console.log('\n✓ Check-in API test completed successfully!');
    
  } catch (error) {
    console.error('\n✗ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run the test
testCheckInAPI();