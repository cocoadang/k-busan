import { refreshAptSales, seedAptSearch } from '../src/housing/aptIndependentSearch';

try {
  const action = process.argv[2];
  if (action !== 'seed' && action !== 'refresh') throw Error('Expected seed or refresh');
  const result = await (action === 'seed' ? seedAptSearch() : refreshAptSales());
  console.log(JSON.stringify(result));
  if ('failures' in result && result.failures.length) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, '[url]') : 'APT_DATA_OPERATION_FAILED');
  process.exitCode = 1;
}
