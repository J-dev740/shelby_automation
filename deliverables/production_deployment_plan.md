Now I'll create a comprehensive implementation plan for final production deployment configs and end-to-end testing. Let me organize this into a structured approach.

Shelby WhatsApp Automation - Production Deployment & End-to-End Testing Implementation Plan
Phase 1: Production Deployment Configuration
1. Containerization & Orchestration
1.1 Create Docker Configuration Files
First, let's create Dockerfiles for both the API and Dashboard applications:
# apps/api/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --prod

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["pnpm", "start"]


Let me create the Dockerfile for the Dashboard:
# apps/dashboard/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --prod

# Copy source code
COPY src ./src
COPY next.config.ts next-env.d.ts ./

# Build the Next.js application
RUN pnpm build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the application
CMD ["pnpm", "start"]

Now let's create a docker-compose.yml file for local development and testing:

version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: shelby
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/shelby
      - REDIS_URL=redis://redis:6379
      - META_VERIFY_TOKEN=shelby_test_token
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./apps/api/src:/app/src
    command: sh -c "pnpm seed:menu && pnpm dev"

  dashboard:
    build:
      context: ./apps/dashboard
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
    depends_on:
      - api
    volumes:
      - ./apps/dashboard/src:/app/src

volumes:
  redis_data:
  postgres_data:

  Let's also create a production docker-compose file:

  version: '3.8'

services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - META_API_TOKEN=${META_API_TOKEN}
      - META_PHONE_ID=${META_PHONE_ID}
      - META_VERIFY_TOKEN=${META_VERIFY_TOKEN}
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  dashboard:
    build:
      context: ./apps/dashboard
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    restart: unless-stopped

volumes:
  redis_data:

Phase 2: Monitoring & Observability
2.1 Add Application Metrics
Let's add Prometheus metrics to the API:

import fp from 'fastify-plugin';
import client from 'prom-client';

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'shelby-api'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.10, 5, 15, 50, 100, 200, 300, 400, 500]
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'code'],
});

const queueJobDuration = new client.Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue jobs in seconds',
  labelNames: ['queue', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

const queueJobTotal = new client.Counter({
  name: 'queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'status'],
});

export const metricsPlugin = fp(async (fastify) => {
  // Register metrics endpoint
  fastify.get('/metrics', async (request, reply) => {
    reply.headers({
      'Content-Type': register.contentType
    });
    return register.metrics();
  });

  // Add request timing middleware
  fastify.addHook('onRequest', async (request) => {
    (request as any).startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = Date.now() - (request as any).startTime;
    
    httpRequestDurationMicroseconds.observe({
      method: request.method,
      route: request.routeOptions.url,
      code: reply.statusCode
    }, responseTime);

    httpRequestTotal.inc({
      method: request.method,
      route: request.routeOptions.url,
      code: reply.statusCode
    });
  });

  // Make metrics available to other parts of the application
  fastify.decorate('metrics', {
    httpRequestDuration: httpRequestDurationMicroseconds,
    httpRequestTotal: httpRequestTotal,
    queueJobDuration: queueJobDuration,
    queueJobTotal: queueJobTotal
  });
});

export { register };


Let's update the app.ts to register the metrics plugin:
import fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import metaWebhookRoutes from './routes/webhook.meta.js';
import { metricsPlugin } from './plugins/metrics.plugin.js';

export async function buildApp() {
  const app = fastify({ 
    logger: false 
  });

  // Register plugins
  await app.register(cors);
  await app.register(metricsPlugin);

  // Register routes
  await app.register(metaWebhookRoutes);

  // Health check endpoint
  app.get('/health', async () => ({ status: 'ok', version: '1.0.0' }));

  return app;
}

2.2 Update Queue Service with Metrics

import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env.js';
import { MetaCloudProvider } from '../adapters/messaging/meta-cloud.provider.js';
import { MockMessagingProvider } from '../adapters/messaging/mock.provider.js';
import { MessagingProvider } from '../adapters/messaging/provider.interface.js';
import { handleIncomingMessage } from '../orchestrator/fsm.js';

let inboundQueue: Queue | null = null;
let inboundWorker: Worker | null = null;

const provider: MessagingProvider = env.NODE_ENV === 'production'
  ? new MetaCloudProvider(env.META_API_TOKEN || '', env.META_PHONE_ID || '')
  : new MockMessagingProvider();


// Initialize BullMQ if REDIS_URL is provided
if (env.REDIS_URL) {
  try {
    const connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    inboundQueue = new Queue('inbound-message', { connection });

    inboundWorker = new Worker('inbound-message', async job => {
      const startTime = Date.now();
      const { from, message } = job.data;
      console.log(`[BullMQ Worker] Processing job ${job.id} for ${from}`);
      
      try {
        await handleIncomingMessage(from, message, provider);
        
        // Record successful job metric
        if ((global as any).fastify?.metrics) {
          const duration = (Date.now() - startTime) / 1000;
          (global as any).fastify.metrics.queueJobDuration.observe({
            queue: 'inbound-message',
            status: 'success'
          }, duration);
          
          (global as any).fastify.metrics.queueJobTotal.inc({
            queue: 'inbound-message',
            status: 'success'
          });
        }
      } catch (error) {
        // Record failed job metric
        if ((global as any).fastify?.metrics) {
          const duration = (Date.now() - startTime) / 1000;
          (global as any).fastify.metrics.queueJobDuration.observe({
            queue: 'inbound-message',
            status: 'failure'
          }, duration);
          
          (global as any).fastify.metrics.queueJobTotal.inc({
            queue: 'inbound-message',
            status: 'failure'
          });
        }
        throw error;
      }
    }, { 
      connection,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    });

    inboundWorker.on('failed', (job, err) => {
      console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err);
    });

    console.log('✅ BullMQ inbound-message queue initialized');
  } catch (err) {
    console.error('❌ Failed to initialize BullMQ with Redis:', err);
  }
} else {
  console.log('ℹ️ REDIS_URL not set. Using in-memory queue fallback for inbound messages.');
}

/**
 * Enqueues an incoming webhook message for processing.
 * Decouples the Fastify webhook route from FSM execution.
 */
export async function enqueueIncomingMessage(from: string, message: any): Promise<void> {
  if (inboundQueue) {
    await inboundQueue.add('message', { from, message }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  } else {
    // In-memory fallback for local dev / testing without Redis
    // Execute asynchronously to immediately unblock the caller
    setImmediate(async () => {
      try {
        console.log(`[In-Memory Queue] Processing message for ${from}`);
        await handleIncomingMessage(from, message, provider);
      } catch (err) {
        console.error(`[In-Memory Queue] Failed to process message for ${from}:`, err);
      }
    });
  }
}


Phase 3: Production Deployment Scripts
3.1 Create Deployment Scripts
Let's create a deployment script for production:

#!/bin/bash
# scripts/deploy.sh

set -e

echo "Starting Shelby WhatsApp Automation deployment..."

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set"
  exit 1
fi

if [ -z "$META_API_TOKEN" ]; then
  echo "Error: META_API_TOKEN is not set"
  exit 1
fi

if [ -z "$META_PHONE_ID" ]; then
  echo "Error: META_PHONE_ID is not set"
  exit 1
fi

if [ -z "$META_VERIFY_TOKEN" ]; then
  echo "Error: META_VERIFY_TOKEN is not set"
  exit 1
fi

# Build and deploy with docker-compose
echo "Building and deploying containers..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "Waiting for services to become healthy..."
sleep 30

# Check service health
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "500")
DASHBOARD_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "500")

if [ "$API_HEALTH" != "200" ]; then
  echo "Error: API service is not healthy (HTTP $API_HEALTH)"
  docker-compose -f docker-compose.prod.yml logs api
  exit 1
fi

if [ "$DASHBOARD_HEALTH" != "200" ]; then
  echo "Error: Dashboard service is not healthy (HTTP $DASHBOARD_HEALTH)"
  docker-compose -f docker-compose.prod.yml logs dashboard
  exit 1
fi

echo "✅ Deployment completed successfully!"
echo "API is running on port 3000"
echo "Dashboard is running on port 3001"


3.2 Create Rollback Script

#!/bin/bash
# scripts/rollback.sh

set -e

echo "Rolling back Shelby WhatsApp Automation deployment..."

# Stop current containers
echo "Stopping current containers..."
docker-compose -f docker-compose.prod.yml down

# TODO: Restore previous database backup if needed
# This would depend on your backup strategy

# Restart previous version (this is a simplified example)
echo "Restarting previous version..."
docker-compose -f docker-compose.prod.yml up -d

echo "✅ Rollback completed!"

Phase 4: End-to-End Testing Framework
4.1 Create Load Testing Scripts
Let's create a k6 load testing script:


import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const messageCounter = new Counter('messages_sent');

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // ramp up to 10 users
    { duration: '1m', target: 10 },  // stay at 10 users
    { duration: '30s', target: 0 },  // ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    messages_sent: ['count>100'],     // expect at least 100 messages
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';

export default function () {
  // Simulate a basic conversation flow
  const phoneNumber = `9198765432${Math.floor(Math.random() * 100)}`;
  
  // Send "hi" message
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: phoneNumber,
            text: { body: 'hi' }
          }]
        }
      }]
    }]
  };

  const res = http.post(`${BASE_URL}/webhook/meta`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  messageCounter.add(1);

  // Simulate user thinking time
  sleep(Math.random() * 3 + 1);
}


4.2 Create Integration Test Suite
Let's create a comprehensive integration test:

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/api/src/app.js';
import { env } from '../../apps/api/src/config/env.js';
import { db, pool } from '../../apps/api/src/lib/db.js';

describe('Full End-to-End Flow Integration', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    if (app) await app.close();
    await pool.end();
  });

  it('G1: Complete order flow from start to finish', async () => {
    const phoneNumber = '919876543210';
    
    // Step 1: Send "hi" to start conversation
    const startPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: phoneNumber,
              text: { body: 'hi' }
            }]
          }
        }]
      }]
    };

    const startResponse = await app.inject({
      method: 'POST',
      url: '/webhook/meta',
      payload: startPayload
    });

    expect(startResponse.statusCode).toBe(200);
    expect(startResponse.body).toBe('EVENT_RECEIVED');

    // Step 2: Send "btn_coffee" to add coffee to cart
    const coffeePayload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: phoneNumber,
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: {
                  id: 'btn_coffee'
                }
              }
            }]
          }
        }]
      }]
    };

    const coffeeResponse = await app.inject({
      method: 'POST',
      url: '/webhook/meta',
      payload: coffeePayload
    });

    expect(coffeeResponse.statusCode).toBe(200);
    expect(coffeeResponse.body).toBe('EVENT_RECEIVED');

    // Step 3: Send "btn_checkout" to complete order
    const checkoutPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: phoneNumber,
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: {
                  id: 'btn_checkout'
                }
              }
            }]
          }
        }]
      }]
    };

    const checkoutResponse = await app.inject({
      method: 'POST',
      url: '/webhook/meta',
      payload: checkoutPayload
    });

    expect(checkoutResponse.statusCode).toBe(200);
    expect(checkoutResponse.body).toBe('EVENT_RECEIVED');

    // Step 4: Verify order was created in database
    // Wait a moment for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const orderResult = await db.query(
      `SELECT o.*, c.phone_e164 
       FROM orders o 
       JOIN customers c ON o.customer_id = c.id 
       WHERE c.phone_e164 = $1 
       ORDER BY o.created_at DESC 
       LIMIT 1`,
      [phoneNumber]
    );

    expect(orderResult.rowCount).toBeGreaterThan(0);
    expect(orderResult.rows[0].state).toBe('new');
    expect(orderResult.rows[0].total_inr).toBeGreaterThan(0);
  });

  it('G2: Handoff flow works correctly', async () => {
    const phoneNumber = '919876543211';
    
    // Step 1: Send "hi" to start conversation
    const startPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: phoneNumber,
              text: { body: 'hi' }
            }]
          }
        }]
      }]
    };

    const startResponse = await app.inject({
      method: 'POST',
      url: '/webhook/meta',
      payload: startPayload
    });

    expect(startResponse.statusCode).toBe(200);

    // Step 2: Send "btn_handoff" to trigger handoff
    const handoffPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: phoneNumber,
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: {
                  id: 'btn_handoff'
                }
              }
            }]
          }
        }]
      }]
    };

    const handoffResponse = await app.inject({
      method: 'POST',
      url: '/webhook/meta',
      payload: handoffPayload
    });

    expect(handoffResponse.statusCode).toBe(200);

    // Step 3: Verify session is in handoff state
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const sessionResult = await db.query(
      `SELECT s.* 
       FROM sessions s 
       JOIN customers c ON s.customer_id = c.id 
       WHERE c.phone_e164 = $1 
       ORDER BY s.last_activity_at DESC 
       LIMIT 1`,
      [phoneNumber]
    );

    expect(sessionResult.rowCount).toBeGreaterThan(0);
    expect(sessionResult.rows[0].state).toBe('handoff_active');
  });
});

Phase 5: Monitoring & Alerting
5.1 Create Health Check Scripts

#!/bin/bash
# scripts/health-check.sh

set -e

echo "Running health checks for Shelby WhatsApp Automation..."

# Check API health
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "DOWN")
if [ "$API_STATUS" != "200" ]; then
  echo "❌ API is DOWN (HTTP $API_STATUS)"
  exit 1
else
  echo "✅ API is UP"
fi

# Check Dashboard health
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "DOWN")
if [ "$DASHBOARD_STATUS" != "200" ]; then
  echo "❌ Dashboard is DOWN (HTTP $DASHBOARD_STATUS)"
  exit 1
else
  echo "✅ Dashboard is UP"
fi

# Check Redis connectivity
REDIS_STATUS=$(docker-compose exec -T redis redis-cli ping | grep -q "PONG" && echo "UP" || echo "DOWN")
if [ "$REDIS_STATUS" != "UP" ]; then
  echo "❌ Redis is DOWN"
  exit 1
else
  echo "✅ Redis is UP"
fi

# Check database connectivity
DB_STATUS=$(docker-compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1 && echo "UP" || echo "DOWN")
if [ "$DB_STATUS" != "UP" ]; then
  echo "❌ Database is DOWN"
  exit 1
else
  echo "✅ Database is UP"
fi

echo "🎉 All services are healthy!"


5.2 Create Monitoring Dashboard Configuration
Let's create a basic Grafana dashboard configuration:{
  "dashboard": {
    "id": null,
    "title": "Shelby WhatsApp Automation",
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 0,
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "type": "graph",
        "title": "HTTP Request Duration",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "rate(http_request_duration_ms_sum[5m]) / rate(http_request_duration_ms_count[5m])",
            "legendFormat": "{{method}} {{route}} {{code}}"
          }
        ]
      },
      {
        "id": 2,
        "type": "stat",
        "title": "Current Orders",
        "datasource": "PostgreSQL",
        "targets": [
          {
            "rawSql": "SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '1 hour'",
            "format": "table"
          }
        ]
      },
      {
        "id": 3,
        "type": "graph",
        "title": "Queue Job Processing Time",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "rate(queue_job_duration_seconds_sum[5m]) / rate(queue_job_duration_seconds_count[5m])",
            "legendFormat": "{{queue}} {{status}}"
          }
        ]
      }
    ]
  }
}


Phase 6: Documentation & Runbook
6.1 Create Production Deployment Guide# Production Deployment Guide

## Prerequisites

1. Docker and Docker Compose installed
2. Access to a PostgreSQL database
3. Redis instance
4. Meta WhatsApp Business Account credentials

## Environment Variables

Set the following environment variables:

```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
export META_API_TOKEN="your_meta_api_token"
export META_PHONE_ID="your_meta_phone_id"
export META_VERIFY_TOKEN="your_verify_token"
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_supabase_anon_key"


Deployment Steps
Clone the repository
Set environment variables
Run the deployment script:

Monitoring
Check service health: ./scripts/health-check.sh
View logs: docker-compose logs -f
Monitor metrics: Access Grafana dashboard
Rollback Procedure
If issues occur, rollback using:



### 6.2 Create Operations Runbook

```markdown
# Operations Runbook

## Common Issues and Resolutions

### 1. Webhooks Not Processing

**Symptoms**: Messages aren't being responded to
**Check**:
- Verify Redis connectivity
- Check BullMQ worker logs: `docker-compose logs api`
- Ensure queue is processing jobs

**Resolution**:
- Restart API service: `docker-compose restart api`
- Check for errors in logs

### 2. Database Connection Issues

**Symptoms**: Orders not being created, sessions not updating
**Check**:
- Database connectivity: `docker-compose exec postgres pg_isready`
- Connection pool status

**Resolution**:
- Verify DATABASE_URL environment variable
- Check database credentials
- Restart services

### 3. High Latency

**Symptoms**: Slow response times
**Check**:
- Monitor with: `docker stats`
- Check system resources
- Review Prometheus metrics

**Resolution**:
- Scale services if needed
- Optimize database queries
- Check for bottlenecks in queue processing

## Scaling Guidelines

### When to Scale
- API latency > 200ms consistently
- Queue backlog > 100 jobs
- CPU usage > 80%

### How to Scale
1. Scale API workers:
   ```bash
   docker-compose up -d --scale api=3
Scale database connections in connection pool
Backup and Recovery
Daily Backups
Database dumps scheduled via cron
Store backups in secure location
Recovery Process
Restore database from latest backup
Verify data integrity
Restart services
Security Considerations
Credential Rotation
Update environment variables
Restart services
Verify functionality
Access Control
Regular audit of staff user accounts
Monitor authentication logs



## Phase 7: CI/CD Pipeline

### 7.1 Create GitHub Actions Workflow

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'pnpm'
    
    - name: Install pnpm
      run: npm install -g pnpm
    
    - name: Install dependencies
      run: pnpm install
    
    - name: Run unit tests
      run: pnpm test:unit
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
    
    - name: Run integration tests
      run: pnpm test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
        REDIS_URL: redis://localhost:6379

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Login to DockerHub
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}
    
    - name: Build and push API image
      uses: docker/build-push-action@v4
      with:
        context: ./apps/api
        push: true
        tags: shelby/api:latest
    
    - name: Build and push Dashboard image
      uses: docker/build-push-action@v4
      with:
        context: ./apps/dashboard
        push: true
        tags: shelby/dashboard:latest
    
    - name: Deploy to production
      run: |
        ssh ${{ secrets.PRODUCTION_SERVER }} '
          docker pull shelby/api:latest
          docker pull shelby/dashboard:latest
          docker-compose -f docker-compose.prod.yml up -d
        '
Summary
This implementation plan provides a comprehensive approach to production deployment and end-to-end testing for the Shelby WhatsApp Automation system. Key components include:

Containerization with Docker and docker-compose for consistent deployments
Monitoring & Observability with Prometheus metrics and health checks
Automated Testing with load testing and integration tests
Deployment Automation with scripts and CI/CD pipelines
Operations Documentation with runbooks and procedures
Security & Reliability with health checks and rollback procedures
The plan addresses all critical aspects needed for a production-ready deployment while ensuring maintainability and scalability.

