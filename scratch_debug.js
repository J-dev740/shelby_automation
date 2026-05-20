console.log('Starting require check...');
try {
  console.log('Requiring apps/dashboard/node_modules/next/dist/server/require-hook...');
  require('./apps/dashboard/node_modules/next/dist/server/require-hook');
  console.log('require-hook loaded.');

  console.log('Requiring next/dist/compiled/commander...');
  require('./apps/dashboard/node_modules/next/dist/compiled/commander');
  console.log('commander loaded.');

  console.log('Requiring next/dist/build/output/log...');
  require('./apps/dashboard/node_modules/next/dist/build/output/log');
  console.log('log loaded.');

  console.log('Requiring next/dist/compiled/semver...');
  require('./apps/dashboard/node_modules/next/dist/compiled/semver');
  console.log('semver loaded.');

  console.log('Requiring next/dist/lib/picocolors...');
  require('./apps/dashboard/node_modules/next/dist/lib/picocolors');
  console.log('picocolors loaded.');

  console.log('All required files loaded successfully!');
} catch (e) {
  console.error('Error during require:', e);
}
