import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('validates a non-trading product and binds only the accepted installation', async () => {
    const server = app.getHttpServer();
    const login = await request(server).post('/admin/login').send({
      username: process.env.BOOTSTRAP_ADMIN_USERNAME,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    }).expect(201);
    const admin = { Authorization: `Bearer ${login.body.access_token}` };

    const product = await request(server).post('/products/create').set(admin)
      .send({ name: `Sample CLI ${randomUUID()}` }).expect(201);
    const user = await request(server).post('/users/register').set(admin).send({
      username: `tester-${randomUUID()}`,
      email: `${randomUUID()}@example.com`,
      password: randomBytes(24).toString('hex'),
    }).expect(201);

    const license = await request(server).post('/licenses/issue').set(admin)
      .send({ userId: user.body.user.id, productId: product.body.id, daysValid: 7 }).expect(201);
    expect(license.body.license_key).toMatch(/^LE-[A-F0-9]{32}$/);
    const check = {
      licenseKey: license.body.license_key,
      productId: product.body.id,
      machineId: randomUUID(),
    };

    await request(server).post('/licenses/validate')
      .send({ ...check, productId: randomUUID(), machineId: randomUUID() }).expect(403);
    const script = resolve(__dirname, '../../../examples/node/check-license.mjs');
    const accepted = await promisify(execFile)(process.execPath, [script], {
      env: {
        FXCRUX_API_URL: await app.getUrl(),
        FXCRUX_PRODUCT_ID: check.productId,
        FXCRUX_LICENSE_KEY: check.licenseKey,
        FXCRUX_DEVICE_ID: check.machineId,
      },
    });
    expect(accepted.stdout).toContain('License accepted.');
    await request(server).post('/licenses/validate')
      .send({ ...check, machineId: randomUUID() }).expect(403);
    await request(server).post('/licenses/validate')
      .send({ licenseKey: check.licenseKey, machineId: check.machineId }).expect(200);
    await request(server).post('/licenses/validate')
      .send({ ...check, productId: null }).expect(400);
  });

  it('leaves the legacy machine protocol disabled by default', () => {
    return request(app.getHttpServer()).post('/licenses/list-by-machine')
      .send({ payload: 'test', key: 'test', iv: 'test' }).expect(404);
  });

  afterAll(async () => {
    if (app) await app.close();
  });
});
