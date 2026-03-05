/**
 * Clinical Trials API Integration Test
 * Tests direct calls to ClinicalTrials.gov API v2
 * 
 * Run: node tests/api-test.js
 */

const BASE_URL = 'https://clinicaltrials.gov/api/v2';

async function testApiCall(testName, url, expectedStatus = 200) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log(`   URL: ${url}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    const elapsed = Date.now() - startTime;

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Time: ${elapsed}ms`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ SUCCESS`);
      console.log(`   Response keys:`, Object.keys(data).join(', '));
      
      if (data.studies) {
        console.log(`   Studies returned: ${data.studies.length}`);
      }
      if (data.totalCount !== undefined) {
        console.log(`   Total count: ${data.totalCount}`);
      }
      
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log(`   ❌ FAILED: ${response.status} ${response.statusText}`);
      console.log(`   Error:`, errorText.substring(0, 200));
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.log(`   ❌ ERROR:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('=================================================');
  console.log('Clinical Trials API v2 - Integration Tests');
  console.log('=================================================');
  console.log('Base URL:', BASE_URL);
  console.log('Date:', new Date().toISOString());
  console.log('=================================================');

  const results = [];

  // Test 1: Basic studies endpoint with no parameters
  results.push(await testApiCall(
    'Basic Studies List (no params)',
    `${BASE_URL}/studies`
  ));

  // Test 2: Studies with pageSize
  results.push(await testApiCall(
    'Studies with pageSize=10',
    `${BASE_URL}/studies?pageSize=10`
  ));

  // Test 3: Studies with query search
  results.push(await testApiCall(
    'Search by query: diabetes',
    `${BASE_URL}/studies?query.cond=diabetes&pageSize=5`
  ));

  // Test 4: Studies with countTotal
  results.push(await testApiCall(
    'Studies with countTotal=true',
    `${BASE_URL}/studies?pageSize=5&countTotal=true`
  ));

  // Test 5: Studies with filter
  results.push(await testApiCall(
    'Filter by overallStatus=RECRUITING',
    `${BASE_URL}/studies?filter.overallStatus=RECRUITING&pageSize=5`
  ));

  // Test 6: Get specific study by NCT ID
  results.push(await testApiCall(
    'Get Study NCT00000102',
    `${BASE_URL}/studies/NCT00000102`
  ));

  // Test 7: Metadata endpoint
  results.push(await testApiCall(
    'Studies Metadata',
    `${BASE_URL}/studies/metadata`
  ));

  // Test 8: Version endpoint
  results.push(await testApiCall(
    'API Version',
    `${BASE_URL}/version`
  ));

  // Test 9: Stats endpoint
  results.push(await testApiCall(
    'Statistics - Database Size',
    `${BASE_URL}/stats/size`
  ));

  // Test 10: Field values stats
  results.push(await testApiCall(
    'Field Values - Phase',
    `${BASE_URL}/stats/field/values?fields=Phase`
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
    console.log('⚠️  Some tests failed. Check the ClinicalTrials.gov API documentation:');
    console.log('   https://clinicaltrials.gov/data-api/api');
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
