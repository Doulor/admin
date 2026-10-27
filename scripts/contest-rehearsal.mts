import { createRehearsal } from './contest-rehearsal-fixture.mjs';

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex < 0 ? 5198 : Number(args[portIndex + 1]);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535
  || args.some((arg, i) => !['--smoke', '--serve', '--completed', '--port'].includes(arg) && !(portIndex >= 0 && i === portIndex + 1))
  || args.includes('--smoke') === args.includes('--serve')) {
  throw new Error('Usage: contest-rehearsal.mts --smoke | --serve [--completed] [--port 5198]');
}
const fixture = await createRehearsal({ port, ...(args.includes('--smoke') ? { staticRoot: false } : {}) });
try {
  if (args.includes('--smoke') || args.includes('--completed')) {
    const result = await fixture.complete();
    await fixture.restart();
    const mine = await fixture.app.inject({ url: '/api/me/competition-results', headers: await fixture.login('alice') });
    if (mine.statusCode !== 200 || mine.json().items[0]?.points !== 350 || !mine.json().items[0]?.prize?.redeemed_at) {
      throw new Error('Restart persistence verification failed');
    }
    console.log(JSON.stringify({ verified: 'inject-full-flow-and-restart', ...result }));
  }
  if (args.includes('--serve')) {
    await fixture.app.listen({ host: '127.0.0.1', port });
    console.log(JSON.stringify({ origin: fixture.origin, ...fixture.status() }, null, 2));
    await new Promise<void>(resolve => {
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
    });
  }
} finally { await fixture.close(); }
