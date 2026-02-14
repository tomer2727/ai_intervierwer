import { mulaw } from 'alawmulaw';

/**
 * Convert mulaw audio (from Twilio) to PCM16 (for OpenAI)
 * @param mulawBase64 Base64-encoded mulaw audio
 * @returns Base64-encoded PCM16 audio
 */
export function mulawToPCM16(mulawBase64: string): string {
  const mulawBuffer = Buffer.from(mulawBase64, 'base64');
  const pcm16Buffer = mulaw.decode(mulawBuffer);
  return Buffer.from(pcm16Buffer).toString('base64');
}

/**
 * Convert PCM16 audio (from OpenAI) to mulaw (for Twilio)
 * @param pcm16Base64 Base64-encoded PCM16 audio
 * @returns Base64-encoded mulaw audio
 */
export function pcm16ToMulaw(pcm16Base64: string): string {
  const pcm16Buffer = Buffer.from(pcm16Base64, 'base64');
  // Convert Buffer to Int16Array for mulaw encoding
  const int16Array = new Int16Array(pcm16Buffer.buffer, pcm16Buffer.byteOffset, pcm16Buffer.length / 2);
  const mulawBuffer = mulaw.encode(int16Array);
  return Buffer.from(mulawBuffer).toString('base64');
}
