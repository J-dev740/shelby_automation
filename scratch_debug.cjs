console.log('Starting next-test dependencies requires...');
try {
  console.log('1. Requiring ../lib/get-project-dir...');
  require('./apps/dashboard/node_modules/next/dist/lib/get-project-dir');
  console.log('get-project-dir loaded.');

  console.log('2. Requiring ../server/config...');
  require('./apps/dashboard/node_modules/next/dist/server/config');
  console.log('config loaded.');

  console.log('3. Requiring ../shared/lib/constants...');
  require('./apps/dashboard/node_modules/next/dist/shared/lib/constants');
  console.log('constants loaded.');

  console.log('4. Requiring ../lib/has-necessary-dependencies...');
  require('./apps/dashboard/node_modules/next/dist/lib/has-necessary-dependencies');
  console.log('has-necessary-dependencies loaded.');

  console.log('5. Requiring ../lib/install-dependencies...');
  require('./apps/dashboard/node_modules/next/dist/lib/install-dependencies');
  console.log('install-dependencies loaded.');

  console.log('6. Requiring ../lib/find-pages-dir...');
  require('./apps/dashboard/node_modules/next/dist/lib/find-pages-dir');
  console.log('find-pages-dir loaded.');

  console.log('7. Requiring ../lib/verify-typescript-setup...');
  require('./apps/dashboard/node_modules/next/dist/lib/verify-typescript-setup');
  console.log('verify-typescript-setup loaded.');

  console.log('All next-test deps loaded successfully!');
} catch (e) {
  console.error('Error:', e);
}
