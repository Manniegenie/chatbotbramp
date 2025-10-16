// src/utils/phoneNormalization.test.ts
// Test utilities for phone number normalization

export function normalizePhone(input: string): string {
  const d = input.replace(/[^\d+]/g, '')
  
  // Handle Nigerian phone numbers specifically
  if (/^0\d{10}$/.test(d)) return '+234' + d.slice(1) // 08123456789 -> +2348123456789
  if (/^234\d{10}$/.test(d)) return '+' + d // 2348123456789 -> +2348123456789
  if (/^\+234\d{10}$/.test(d)) return d // +2348123456789 -> +2348123456789
  
  // Handle 10-digit numbers that could be Nigerian (starting with 7, 8, or 9)
  if (/^[789]\d{9}$/.test(d)) return '+234' + d // 8123456789 -> +2348123456789
  
  // Handle other international formats
  if (/^\+?\d{10,15}$/.test(d)) return d.startsWith('+') ? d : '+' + d
  
  return d
}

export function testPhoneNormalization() {
  console.log('🧪 Testing phone number normalization...')
  
  const testCases = [
    // Nigerian formats
    { input: '08123456789', expected: '+2348123456789', description: 'Nigerian with 0 prefix' },
    { input: '2348123456789', expected: '+2348123456789', description: 'Nigerian with 234 prefix' },
    { input: '+2348123456789', expected: '+2348123456789', description: 'Nigerian with +234 prefix' },
    { input: '8123456789', expected: '+2348123456789', description: 'Nigerian 10-digit (starts with 8)' },
    { input: '7054221375', expected: '+2347054221375', description: 'Nigerian 10-digit (starts with 7)' },
    { input: '9054221375', expected: '+2349054221375', description: 'Nigerian 10-digit (starts with 9)' },
    
    // International formats
    { input: '+1234567890', expected: '+1234567890', description: 'US number' },
    { input: '1234567890', expected: '+1234567890', description: 'US number without +' },
    
    // Edge cases
    { input: '8054221375', expected: '+2348054221375', description: 'The problematic case from error' },
    { input: '', expected: '', description: 'Empty string' },
    { input: 'abc', expected: '', description: 'Non-numeric' },
  ]
  
  let passed = 0
  let failed = 0
  
  testCases.forEach(({ input, expected, description }) => {
    const result = normalizePhone(input)
    const success = result === expected
    
    console.log(`${success ? '✅' : '❌'} ${description}:`)
    console.log(`   Input: "${input}"`)
    console.log(`   Expected: "${expected}"`)
    console.log(`   Got: "${result}"`)
    
    if (success) {
      passed++
    } else {
      failed++
    }
  })
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)
  
  if (failed === 0) {
    console.log('🎉 All phone normalization tests passed!')
  } else {
    console.log('❌ Some tests failed. Please check the logic.')
  }
}

// Export for use in development console
if (typeof window !== 'undefined') {
  (window as any).testPhoneNormalization = testPhoneNormalization
}
