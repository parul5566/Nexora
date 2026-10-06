export interface Logger {
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

function emit(level: string, msg: string, meta?: unknown) {
  const line = { ts: new Date().toISOString(), level, msg, ...(meta ? { meta } : {}) };
  console.log(JSON.stringify(line));
}

export const logger: Logger = {
  info: (m, meta) => emit('info', m, meta),
  warn: (m, meta) => emit('warn', m, meta),
  error: (m, meta) => emit('error', m, meta),
};
