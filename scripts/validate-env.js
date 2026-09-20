#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env');
let env = {};
try {
  const content = readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line=>{
    const [k,v] = line.split('=');
    if(k && v) env[k.trim()] = v.trim();
  });
} catch {}
const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'WEBHOOK_HMAC_SECRET',
  'MODEL_PROVIDER_NVIDIA_API_KEY'
];
console.log('Env validation:');
required.forEach(k=>{
  console.log(`${k}: ${env[k] ? 'PRESENT' : 'MISSING'}`);
});
