// Standard envelope returned by every Server Action mutation.
// Server Actions never throw to the client; they return one of these.
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };
