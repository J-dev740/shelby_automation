import crypto from 'crypto';

/**
 * Decrypts the request from WhatsApp Flows
 *
 * @param encryptedAesKeyBase64 Base64 encoded AES key encrypted with our RSA public key
 * @param encryptedFlowDataBase64 Base64 encoded Flow data (AES-GCM encrypted + 16 byte auth tag)
 * @param initialVectorBase64 Base64 encoded 96-bit initial vector
 * @param privateKeyPem Our RSA private key in PEM format
 * @returns { decryptedBody, aesKeyBuffer, initialVectorBuffer }
 */
export function decryptFlowRequest(
  encryptedAesKeyBase64: string,
  encryptedFlowDataBase64: string,
  initialVectorBase64: string,
  privateKeyPem: string
) {
  // 1. Decrypt the AES key using our private RSA key
  const encryptedAesKey = Buffer.from(encryptedAesKeyBase64, 'base64');
  let aesKeyBuffer: Buffer;
  try {
    aesKeyBuffer = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      encryptedAesKey
    );
  } catch (err: any) {
    throw new Error(`Failed to decrypt AES key: ${err.message}`);
  }

  // 2. Extract Auth Tag and Encrypted Data
  const encryptedFlowData = Buffer.from(encryptedFlowDataBase64, 'base64');
  const initialVectorBuffer = Buffer.from(initialVectorBase64, 'base64');

  const TAG_LENGTH = 16;
  if (encryptedFlowData.length <= TAG_LENGTH) {
    throw new Error('Invalid encrypted_flow_data: too short');
  }

  const authTag = encryptedFlowData.subarray(encryptedFlowData.length - TAG_LENGTH);
  const encryptedPayload = encryptedFlowData.subarray(0, encryptedFlowData.length - TAG_LENGTH);

  // 3. Decrypt the Flow data using AES-128-GCM
  let decryptedPayloadBuffer: Buffer;
  try {
    const decipher = crypto.createDecipheriv('aes-128-gcm', aesKeyBuffer, initialVectorBuffer);
    decipher.setAuthTag(authTag);
    
    decryptedPayloadBuffer = Buffer.concat([
      decipher.update(encryptedPayload),
      decipher.final()
    ]);
  } catch (err: any) {
    throw new Error(`Failed to decrypt flow data: ${err.message}`);
  }

  return {
    decryptedBody: JSON.parse(decryptedPayloadBuffer.toString('utf-8')),
    aesKeyBuffer,
    initialVectorBuffer
  };
}

/**
 * Encrypts the response for WhatsApp Flows
 *
 * @param responseData JSON object to send back
 * @param aesKeyBuffer The AES key we got from the decrypt step
 * @param initialVectorBuffer The IV from the decrypt step (we flip bits according to Meta docs)
 * @returns base64 string of the encrypted response (cipher text + auth tag)
 */
export function encryptFlowResponse(
  responseData: object,
  aesKeyBuffer: Buffer,
  initialVectorBuffer: Buffer
): string {
  // WhatsApp requires flipping the bits of the original IV to generate the response IV
  const flippedIv = Buffer.alloc(initialVectorBuffer.length);
  for (let i = 0; i < initialVectorBuffer.length; i++) {
    flippedIv[i] = ~initialVectorBuffer[i];
  }

  const cipher = crypto.createCipheriv('aes-128-gcm', aesKeyBuffer, flippedIv);
  
  const payloadStr = JSON.stringify(responseData);
  const encryptedPayload = Buffer.concat([
    cipher.update(payloadStr, 'utf-8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Combine payload and auth tag
  const finalEncryptedData = Buffer.concat([encryptedPayload, authTag]);

  return finalEncryptedData.toString('base64');
}
