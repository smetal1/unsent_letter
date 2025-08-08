require('./test/setup');
const { jwtService } = require('./src/lib/jwt');

console.log('JWT_PRIVATE_KEY exists:', !!process.env.JWT_PRIVATE_KEY);

if (process.env.JWT_PRIVATE_KEY) {
  console.log('Key length:', process.env.JWT_PRIVATE_KEY.length);
  console.log('Key preview:', process.env.JWT_PRIVATE_KEY.substring(0, 100) + '...');
  
  // Test JWT generation
  jwtService.signServerJWT({
    userId: 'test-user',
    provider: 'google'
  }).then(token => {
    console.log('JWT generated successfully');
  }).catch(error => {
    console.error('JWT generation failed:', error.message);
  });
} else {
  console.log('No private key found');
}