/* v8 ignore file -- test-only harness internals are not production behavior */
import { Readable, Writable } from "node:stream";

type HeaderValue = string | string[] | number | undefined;

export interface HarnessRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface HarnessResponse {
  status: number;
  headers: Record<string, HeaderValue>;
  text: string;
  body: unknown;
}

interface ExpressLikeApp {
  handle: (req: unknown, res: unknown, next: (error?: unknown) => void) => void;
}

class MockResponse extends Writable {
  statusCode = 200;
  headersSent = false;
  locals: Record<string, unknown> = {};
  setHeader!: (name: string, value: HeaderValue) => this;
  getHeader!: (name: string) => HeaderValue;
  removeHeader!: (name: string) => void;
  writeHead!: (statusCode: number, headers?: Record<string, HeaderValue>) => this;
  onceFinished!: () => Promise<HarnessResponse>;

  private readonly headers = new Map<string, HeaderValue>();
  private readonly chunks: Buffer[] = [];
  private resolve!: (value: HarnessResponse) => void;
  private readonly done = new Promise<HarnessResponse>((resolve) => {
    this.resolve = resolve;
  });

  constructor() {
    super();
    const toResult = (): HarnessResponse => {
      const text = Buffer.concat(this.chunks).toString("utf8");
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        body = text;
      }

      return {
        status: this.statusCode,
        headers: Object.fromEntries(this.headers.entries()),
        text,
        body,
      };
    };

    this.write = ((chunk: Buffer | string, encoding?: BufferEncoding | ((error?: Error | null) => void), cb?: (error?: Error | null) => void) => {
      const callback = typeof encoding === "function" ? encoding : cb;
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback?.();
      return true;
    }) as typeof this.write;

    this.end = ((chunk?: Buffer | string | (() => void), encoding?: BufferEncoding | (() => void), cb?: () => void) => {
      let finalChunk: Buffer | string | undefined;
      let finalCallback: (() => void) | undefined;

      if (typeof chunk === "function") {
        finalCallback = chunk;
      } else {
        finalChunk = chunk;
        if (typeof encoding === "function") {
          finalCallback = encoding;
        } else {
          finalCallback = cb;
        }
      }

      if (finalChunk !== undefined) {
        this.chunks.push(Buffer.isBuffer(finalChunk) ? finalChunk : Buffer.from(finalChunk));
      }

      this.headersSent = true;
      finalCallback?.();
      this.resolve(toResult());
      return this;
    }) as typeof this.end;

    this.setHeader = ((name: string, value: HeaderValue) => {
      this.headers.set(name.toLowerCase(), value);
      return this;
    }) as typeof this.setHeader;

    this.getHeader = ((name: string) => {
      return this.headers.get(name.toLowerCase());
    }) as typeof this.getHeader;

    this.removeHeader = ((name: string) => {
      this.headers.delete(name.toLowerCase());
    }) as typeof this.removeHeader;

    this.writeHead = ((statusCode: number, headers?: Record<string, HeaderValue>) => {
      this.statusCode = statusCode;
      if (headers) {
        for (const [name, value] of Object.entries(headers)) {
          this.setHeader(name, value);
        }
      }
      return this;
    }) as typeof this.writeHead;

    this.onceFinished = () => this.done;
  }

  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }
}

export async function invokeExpressApp(app: unknown, request: HarnessRequest): Promise<HarnessResponse> {
  const expressApp = app as ExpressLikeApp;
  const serializedBody = request.body === undefined ? "" : JSON.stringify(request.body);
  const req = Readable.from(serializedBody ? [serializedBody] : []) as Readable & Record<string, unknown>;
  const res = new MockResponse() as MockResponse & Record<string, unknown> & { onceFinished: () => Promise<HarnessResponse> };

  req.method = request.method.toUpperCase();
  req.url = request.url;
  req.originalUrl = request.url;
  req.headers = {
    ...(serializedBody ? { "content-type": "application/json", "content-length": String(Buffer.byteLength(serializedBody)) } : {}),
    ...(request.headers ?? {}),
  };
  req.connection = { remoteAddress: "127.0.0.1" };
  req.socket = req.connection;
  req.httpVersion = "1.1";
  req.httpVersionMajor = 1;
  req.httpVersionMinor = 1;

  res.req = req;
  req.res = res;

  expressApp.handle(req as never, res as never, (error?: unknown) => {
    if (error) {
      throw error;
    }
    if (!res.headersSent) {
      res.end();
    }
  });

  return res.onceFinished();
}
