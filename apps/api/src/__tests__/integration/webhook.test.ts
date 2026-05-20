import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { env } from '../../config/env.js';
import { pool } from '../../lib/db.js';

describe('Meta Webhook Integration', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('F1: GET /webhook/meta with valid token → 200 challenge', async () => {
    const challenge = 'test_challenge_123';
    const response = await app.inject({
      method: 'GET',
      url: '/webhook/meta',
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': env.META_VERIFY_TOKEN,
        'hub.challenge': challenge
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(challenge);
  });

  it('F2: POST /webhook/meta with valid payload → 200 EVENT_RECEIVED', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook/meta',
      payload: {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '1234567890',
                text: { body: 'Hello' }
              }]
            }
          }]
        }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('EVENT_RECEIVED');
  });

  it('Invalid token → 403 Forbidden', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/webhook/meta',
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': '123'
      }
    });

    expect(response.statusCode).toBe(403);
  });
});
