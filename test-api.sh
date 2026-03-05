#!/bin/bash
# Clinical Trials API v2 - Quick Test Script
# Tests various endpoints to diagnose 400 errors

BASE_URL="https://clinicaltrials.gov/api/v2"

echo "================================================="
echo "Clinical Trials API v2 - Quick Diagnostic Test"
echo "================================================="
echo ""

# Test 1: Basic studies endpoint
echo "🧪 Test 1: Basic Studies Endpoint"
echo "URL: $BASE_URL/studies?pageSize=1"
curl -s -w "\nHTTP Status: %{http_code}\n" -H "Accept: application/json" \
  "$BASE_URL/studies?pageSize=1" | jq -r '.studies[0].protocolSection.identificationModule.nctId // "ERROR"' 2>/dev/null || echo "Failed to parse response"
echo ""

# Test 2: Query by condition
echo "🧪 Test 2: Search by Condition (diabetes)"
echo "URL: $BASE_URL/studies?query.cond=diabetes&pageSize=1"
curl -s -w "\nHTTP Status: %{http_code}\n" -H "Accept: application/json" \
  "$BASE_URL/studies?query.cond=diabetes&pageSize=1" | jq -r '.studies | length // "ERROR"' 2>/dev/null || echo "Failed"
echo ""

# Test 3: Filter by status
echo "🧪 Test 3: Filter by Status (RECRUITING)"
echo "URL: $BASE_URL/studies?filter.overallStatus=RECRUITING&pageSize=1"
curl -s -w "\nHTTP Status: %{http_code}\n" -H "Accept: application/json" \
  "$BASE_URL/studies?filter.overallStatus=RECRUITING&pageSize=1" | jq -r '.studies | length // "ERROR"' 2>/dev/null || echo "Failed"
echo ""

# Test 4: Get specific study
echo "🧪 Test 4: Get Specific Study (NCT00000102)"
echo "URL: $BASE_URL/studies/NCT00000102"
curl -s -w "\nHTTP Status: %{http_code}\n" -H "Accept: application/json" \
  "$BASE_URL/studies/NCT00000102" | jq -r '.protocolSection.identificationModule.nctId // "ERROR"' 2>/dev/null || echo "Failed"
echo ""

# Test 5: Metadata endpoint
echo "🧪 Test 5: Metadata Endpoint"
echo "URL: $BASE_URL/studies/metadata"
curl -s -w "\nHTTP Status: %{http_code}\n" -H "Accept: application/json" \
  "$BASE_URL/studies/metadata" | head -5
echo ""

# Test 6: Enums endpoint (SUSPECTED ISSUE)
echo "🧪 Test 6: Enums Endpoint (SUSPECTED ISSUE)"
echo "URL: $BASE_URL/studies/enums"
curl -s -w "\nHTTP Status: %{http_code}\n" -H "Accept: application/json" \
  "$BASE_URL/studies/enums"
echo ""

# Test 7: Version endpoint
echo "🧪 Test 7: Version Endpoint"
echo "URL: $BASE_URL/version"
curl -s -w "\nHTTP Status: %{http_code}\n" -H "Accept: application/json" \
  "$BASE_URL/version"
echo ""

# Test 8: Stats size
echo "🧪 Test 8: Stats Size Endpoint"
echo "URL: $BASE_URL/stats/size"
curl -s -w "\nHTTP Status: %{http_code}\n" -H "Accept: application/json" \
  "$BASE_URL/stats/size"
echo ""

echo "================================================="
echo "Test Complete"
echo "Check HTTP Status codes: 200 = OK, 400 = Bad Request, 404 = Not Found"
echo "================================================="
