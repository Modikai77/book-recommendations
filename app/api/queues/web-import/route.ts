import { handleCallback } from "@vercel/queue";
import { processWebImport, type ImportMessage } from "@/lib/web-import";

export const maxDuration = 300;
const handleMessage = handleCallback<ImportMessage>(
  (message, metadata) => processWebImport(message, metadata.deliveryCount),
  { retry: (_error, metadata) => ({ afterSeconds: Math.min(60, 5 * metadata.deliveryCount) }) }
);

export async function POST(request: Request) {
  return handleMessage(request);
}
