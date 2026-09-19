import { createHmac, timingSafeEqual } from 'crypto';

export async function verifyHmac(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Expected format: "sha256=<hex>"
    const [algorithm, receivedHash] = signature.split('=');
    
    if (algorithm !== 'sha256' || !receivedHash) {
      return false;
    }

    const expectedHmac = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const receivedBuffer = Buffer.from(receivedHash, 'hex');
    const expectedBuffer = Buffer.from(expectedHmac, 'hex');

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export function generateHmac(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `sha256=${hmac}`;
}