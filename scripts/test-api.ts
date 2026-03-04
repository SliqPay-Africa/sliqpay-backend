// Using native fetch (Node 18+)
// To test protected routes, we capture the Set-Cookie header

const defaultUrl = 'https://sliqpay-backend.vercel.app/api/v1';
const BASE_URL = process.argv[2] || defaultUrl;

async function testEndpoint(name: string, path: string, method: string = 'GET', body: any = null, cookie: string | null = null) {
  process.stdout.write(`Testing ${name} (${method} ${path})... `);
  try {
    const headers: any = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;

    const options: any = {
      method,
      headers,
    };
    if (body) options.body = JSON.stringify(body);

    const start = Date.now();
    const response = await fetch(`${BASE_URL}${path}`, options);
    const duration = Date.now() - start;

    if (response.ok) {
      console.log(`✅ ${response.status} (${duration}ms)`);
    } else {
      console.log(`❌ ${response.status} (${duration}ms)`);
      const text = await response.text();
      console.log(`   Error: ${text.slice(0, 100).replace(/\n/g, ' ')}...`);
    }
    return response;
  } catch (error: any) {
    console.log(`💥 FAILED: ${error.message}`);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting SliqPay API smoke tests...');
  console.log(`📍 Targeting: ${BASE_URL}\n`);

  // 1. Health
  await testEndpoint('Health Check', '/health');

  // 2. Waitlist
  await testEndpoint('Join Waitlist', '/waitlist', 'POST', {
    email: `tester-${Date.now()}@test.com`,
    firstName: 'Smoke',
    lastName: 'Test'
  });

  // 3. User Flow
  const testEmail = `user-${Date.now()}@sliq.com`;
  const signupRes = await testEndpoint('User Signup', '/auth/signup', 'POST', {
    email: testEmail,
    password: 'password123',
    fname: 'Smoke',
    lname: 'User'
  });

  if (signupRes && signupRes.ok) {
    const setCookie = signupRes.headers.get('set-cookie');
    // Extract just the cookie parts (key=value) and join with ;
    const cookie = setCookie?.split(',').map(c => c.split(';')[0].trim()).join('; ') || null;
    
    // Test Profile
    await testEndpoint('Get Profile', '/user', 'GET', null, cookie);
    await testEndpoint('Update Profile', '/user', 'PATCH', { firstName: 'Updated' }, cookie);
    
    // Test Wallet
    await testEndpoint('Get Wallet', '/account/me', 'GET', null, cookie);
  }

  // 4. Admin Flow (using the user we promoted earlier)
  const adminLogin = await testEndpoint('Admin Login', '/auth/login', 'POST', {
    email: 'tester-807@sliq.com',
    password: 'password123456'
  });

  if (adminLogin && adminLogin.ok) {
    const setCookie = adminLogin.headers.get('set-cookie');
    const adminCookie = setCookie?.split(',').map(c => c.split(';')[0].trim()).join('; ') || null;
    
    await testEndpoint('Admin: List Users', '/admin/users', 'GET', null, adminCookie);
    await testEndpoint('Admin: View Waitlist', '/admin/waitlist', 'GET', null, adminCookie);
    await testEndpoint('Admin: Export Waitlist', '/admin/waitlist/export', 'GET', null, adminCookie);
  }

  console.log('\n✨ All tests completed.');
}

runTests();
