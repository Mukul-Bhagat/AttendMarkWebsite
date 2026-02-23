type ConsoleMethod = (...args: unknown[]) => void;

const devOnly =
  (method: ConsoleMethod): ConsoleMethod =>
  (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      method(...args);
    }
  };

export const appLogger = {
  info: devOnly(console.log),
  warn: devOnly(console.warn),
  error: devOnly(console.error),
};
