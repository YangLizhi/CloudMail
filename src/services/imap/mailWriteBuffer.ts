import { withTransaction } from "../db/connection";
import { upsertThread } from "../db/threads";
import { upsertMessage } from "../db/messages";
import { setThreadLabels } from "../db/threads";
import { upsertAttachment } from "../db/attachments";

type ThreadInput = Parameters<typeof upsertThread>[0];
type MessageInput = Parameters<typeof upsertMessage>[0];
type AttachmentInput = Parameters<typeof upsertAttachment>[0];

const FLUSH_THRESHOLD = 600;

let threadQueue: ThreadInput[] = [];
let messageQueue: MessageInput[] = [];
let attachmentQueue: AttachmentInput[] = [];
let labelQueue: { accountId: string; threadId: string; labelIds: string[] }[] = [];
let flushing = false;

function totalPending(): number {
  return threadQueue.length + messageQueue.length + attachmentQueue.length + labelQueue.length;
}

async function drain(): Promise<void> {
  const threads = threadQueue;
  const messages = messageQueue;
  const attachments = attachmentQueue;
  const labels = labelQueue;

  threadQueue = [];
  messageQueue = [];
  attachmentQueue = [];
  labelQueue = [];

  await withTransaction(async () => {
    for (const thread of threads) {
      await upsertThread(thread);
    }
    for (const msg of messages) {
      await upsertMessage(msg);
    }
    for (const label of labels) {
      await setThreadLabels(label.accountId, label.threadId, label.labelIds);
    }
    for (const att of attachments) {
      await upsertAttachment(att);
    }
  });
}

export async function enqueueThread(input: ThreadInput): Promise<void> {
  threadQueue.push(input);
  if (totalPending() >= FLUSH_THRESHOLD) {
    await flushMailWriteBuffer();
  }
}

export async function enqueueMessage(input: MessageInput): Promise<void> {
  messageQueue.push(input);
  if (totalPending() >= FLUSH_THRESHOLD) {
    await flushMailWriteBuffer();
  }
}

export async function enqueueAttachment(input: AttachmentInput): Promise<void> {
  attachmentQueue.push(input);
  if (totalPending() >= FLUSH_THRESHOLD) {
    await flushMailWriteBuffer();
  }
}

export async function enqueueThreadLabels(
  accountId: string,
  threadId: string,
  labelIds: string[],
): Promise<void> {
  labelQueue.push({ accountId, threadId, labelIds });
  if (totalPending() >= FLUSH_THRESHOLD) {
    await flushMailWriteBuffer();
  }
}

export async function flushMailWriteBuffer(): Promise<void> {
  if (flushing || totalPending() === 0) return;
  flushing = true;
  try {
    await drain();
  } finally {
    flushing = false;
  }
}

export function clearMailWriteBuffer(): void {
  threadQueue = [];
  messageQueue = [];
  attachmentQueue = [];
  labelQueue = [];
}
