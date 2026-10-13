import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Deploy safety: migrations must not ride along with every container boot.
 * A failed migrate in `start` is an outage; a failed PRE_DEPLOY job is a
 * cancelled deploy that leaves the previous version serving.
 */
describe('package.json start scripts', () => {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };

  it('does not run migrate deploy on start / start:prod', () => {
    expect(pkg.scripts.start).not.toMatch(/migrate\s+deploy/);
    expect(pkg.scripts['start:prod']).not.toMatch(/migrate\s+deploy/);
  });

  it('exposes a dedicated migrate deploy script for PRE_DEPLOY', () => {
    expect(pkg.scripts['db:migrate:deploy']).toMatch(/prisma\s+migrate\s+deploy/);
  });

  it('still starts the Nest process on start:prod', () => {
    expect(pkg.scripts['start:prod']).toMatch(/node .*dist\/main\.js/);
  });
});
