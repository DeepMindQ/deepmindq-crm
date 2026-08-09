/**
 * Prisma client extension that transparently decrypts PII fields on read.
 * This ensures all contact and user queries return decrypted PII.
 *
 * Uses Prisma 6 $extends API (replaces the removed $use middleware).
 */
import { decryptField } from '@/lib/encryption';
import { Prisma } from '@prisma/client';

const CONTACT_PII_FIELDS = ['email', 'phone', 'linkedinUrl', 'rawName', 'normalizedName'];
const USER_PII_FIELDS = ['email', 'phone'];

const READ_OPERATIONS = ['findUnique', 'findFirst', 'findMany', 'groupBy'];

export function createEncryptionExtension() {
  return Prisma.defineExtension({
    name: 'encryptionDecryption',
    query: {
      contact: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $allOperations: async (args: any) => {
          const { _args, query, operation } = args;
          const result = await query(_args);
          if (READ_OPERATIONS.includes(operation)) {
            if (Array.isArray(result)) {
              for (const record of result) {
                await decryptRecordFields(record as Record<string, unknown>, CONTACT_PII_FIELDS);
              }
            } else if (result) {
              await decryptRecordFields(result as Record<string, unknown>, CONTACT_PII_FIELDS);
            }
          }
          return result;
        },
      },
      user: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $allOperations: async (args: any) => {
          const { _args, query, operation } = args;
          const result = await query(_args);
          if (READ_OPERATIONS.includes(operation)) {
            if (Array.isArray(result)) {
              for (const record of result) {
                await decryptRecordFields(record as Record<string, unknown>, USER_PII_FIELDS);
              }
            } else if (result) {
              await decryptRecordFields(result as Record<string, unknown>, USER_PII_FIELDS);
            }
          }
          return result;
        },
      },
    },
  });
}

async function decryptRecordFields(record: Record<string, unknown>, fields: string[]): Promise<void> {
  for (const field of fields) {
    if (record && typeof record[field] === 'string' && record[field]) {
      const decrypted = await decryptField(field, record[field] as string);
      if (decrypted !== null) {
        record[field] = decrypted;
      }
    }
  }
}
