import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { logger } from '../logging/logger';

/** Background jobs (DIG-31 queue: 3 tries, then the dead-letter queue). Ids only in a job. */
export type Job = { type: 'render-summary'; visitId: string; version: number };

export type JobHandler = (job: Job) => Promise<void>;

export interface JobQueue {
  send(job: Job): Promise<void>;
  /** Starts handing jobs to `handler` (the worker runs in the API process). */
  start(handler: JobHandler): void;
  stop(): Promise<void>;
}

function isJob(v: unknown): v is Job {
  const j = v as Partial<Job>;
  return j?.type === 'render-summary' && typeof j.visitId === 'string' && typeof j.version === 'number';
}

/** SQS with long polling. A failed job is not deleted, so SQS retries it, then dead-letters it. */
export class SqsJobQueue implements JobQueue {
  private readonly sqs: SQSClient;
  private running = false;
  private loop: Promise<void> | null = null;

  constructor(
    private readonly queueUrl: string,
    region: string,
  ) {
    this.sqs = new SQSClient({ region });
  }

  async send(job: Job): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: JSON.stringify(job) }),
    );
  }

  start(handler: JobHandler): void {
    if (this.running) return;
    this.running = true;
    this.loop = this.poll(handler);
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.loop;
  }

  private async poll(handler: JobHandler): Promise<void> {
    while (this.running) {
      try {
        const out = await this.sqs.send(
          new ReceiveMessageCommand({ QueueUrl: this.queueUrl, MaxNumberOfMessages: 5, WaitTimeSeconds: 20 }),
        );
        for (const m of out.Messages ?? []) {
          const job: unknown = JSON.parse(m.Body ?? 'null');
          if (!isJob(job)) {
            logger.warn({ messageId: m.MessageId }, 'unknown job dropped');
          } else {
            try {
              await handler(job);
            } catch (err) {
              logger.error(
                { type: job.type, visitId: job.visitId, err: (err as Error).message },
                'job failed',
              );
              continue; // left on the queue: retried, then dead-lettered
            }
          }
          await this.sqs.send(
            new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: m.ReceiptHandle }),
          );
        }
      } catch (err) {
        logger.error({ err: (err as Error).message }, 'job queue poll failed');
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  }
}

/** Local runs and tests: runs each job straight after the request, in the same process. */
export class InlineJobQueue implements JobQueue {
  private handler: JobHandler | null = null;
  private pending = new Set<Promise<void>>();

  async send(job: Job): Promise<void> {
    if (!this.handler) return;
    const p = this.handler(job)
      .catch((err: unknown) => logger.error({ type: job.type, err: (err as Error).message }, 'job failed'))
      .finally(() => this.pending.delete(p));
    this.pending.add(p);
  }

  start(handler: JobHandler): void {
    this.handler = handler;
  }

  /** Tests: wait for queued jobs to finish. */
  async idle(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
  }

  async stop(): Promise<void> {
    await this.idle();
    this.handler = null;
  }
}
