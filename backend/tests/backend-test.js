/**
 * Backend API Endpoint Test
 * Tests our Next.js backend API routes
 * 
 * Prerequisites: Backend server running on localhost:3001
 * Run: node tests/backend-test.js
 */

const BACKEND_URL = 'http://localhost:3001/api';

async function testEndpoint(testName, endpoint, method = 'GET', body = null) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log(`   Endpoint: ${endpoint}`);
  
  try {
    const startTime = Date.now();
    const options = {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BACKEND_URL}${endpoint}`, options);
    const elapsed = Date.now() - startTime;

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Time: ${elapsed}ms`);

    const data = await response.json();

    if (response.ok) {
      console.log(`   ✅ SUCCESS`);
      if (data.data) {
        console.log(`   Response type:`, typeof data.data);
        if (Array.isArray(data.data)) {
          console.log(`   Array length: ${data.data.length}`);
        } else if (data.data.studies) {
          console.log(`   Studies: ${data.data.studies.length}`);
        }
      }
      return { success: true, data };
    } else {
      console.log(`   ❌ FAILED`);
      console.log(`   Error:`, data.error || data.message);
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`   ❌ ERROR:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runBackendTests() {
  console.log('=================================================');
  console.log('Backend API Endpoint Tests');
  console.log('=================================================');
  console.log('Backend URL:', BACKEND_URL);
  console.log('Date:', new Date().toISOString());
  console.log('=================================================');

  const results = [];

  // Test 1: Health check
  results.push(await testEndpoint(
    'Health Check',
    '/health'
  ));

  // Test 2: Version
  results.push(await testEndpoint(
    'API Version',
    '/version'
  ));

  // Test 3: Basic studies search
  results.push(await testEndpoint(
    'Studies - Basic Search',
    '/studies?pageSize=5'
  ));

  // Test 4: Studies with condition filter
  results.push(await testEndpoint(
    'Studies - Search by Condition (diabetes)',
    '/studies?condition=diabetes&pageSize=5'
  ));

  // Test 5: Studies with status filter
  results.push(await testEndpoint(
    'Studies - Filter by Status (RECRUITING)',
    '/studies?overallStatus=RECRUITING&pageSize=5'
  ));

  // Test 6: Get specific study
  results.push(await testEndpoint(
    'Get Specific Study (NCT00000102)',
    '/studies/NCT00000102'
  ));

  // Test 7: Enums
  results.push(await testEndpoint(
    'Get Enum Values',
    '/studies/enums'
  ));

  // Test 8: Metadata
  results.push(await testEndpoint(
    'Get Metadata',
    '/studies/metadata'
  ));

  // Test 9: Search Areas
  results.push(await testEndpoint(
    'Get Search Areas',
    '/studies/search-areas'
  ));

  // Test 10: Statistics - Size
  results.push(await testEndpoint(
    'Statistics - Database Size',
    '/stats/size'
  ));

  // Test 11: Field Values Stats
  results.push(await testEndpoint(
    'Field Values - Phase',
    '/stats/field/values?fields=Phase'
  ));

  // Summary
  console.log('\n=================================================');
  console.log('TEST SUMMARY');
  console.log('=================================================');
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total:  ${results.length}`);
  console.log('=================================================\n');

  if (failed > 0) {
    console.log('⚠️  Some backend tests failed.');
    console.log('   Make sure the backend is running on localhost:3001');
    process.exit(1);
  } else {
    console.log('🎉 All backend tests passed!');
    process.exit(0);
  }
}

// Check if backend is reachable first
async function checkBackendHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (!response.ok) {
      throw new Error('Backend health check failed');
    }
    return true;
  } catch (error) {
    console.error('❌ Cannot connect to backend at', BACKEND_URL);
    console.error('   Make sure backend is running: cd backend && npm run dev');
    process.exit(1);
  }
}

// Run tests
checkBackendHealth()
  .then(() => runBackendTests())
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
