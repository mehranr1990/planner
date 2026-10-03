export interface DependencyEdge {
  blockingTaskId: string;
  blockedTaskId: string;
}

/**
 * Would adding `blocking → blocked` create a cycle?
 * True when `blocked` already (transitively) blocks `blocking`, or it is a self-edge.
 * `edges` must contain the existing edges reachable from `blocked` (the caller loads them).
 */
export function wouldCreateCycle(edges: readonly DependencyEdge[], blocking: string, blocked: string): boolean {
  if (blocking === blocked) return true;
  const out = new Map<string, string[]>();
  for (const e of edges) {
    const list = out.get(e.blockingTaskId);
    if (list) list.push(e.blockedTaskId);
    else out.set(e.blockingTaskId, [e.blockedTaskId]);
  }
  const seen = new Set<string>();
  const stack = [blocked];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === blocking) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const next of out.get(node) ?? []) stack.push(next);
  }
  return false;
}
