/**
 * An agent is known by its access token, so two agents sharing a token are
 * one actor; that lets an agent that lost its context reclaim its task.
 */
export type Actor =
  | { readonly kind: "agent"; readonly id: string; readonly name: string }
  | { readonly kind: "human"; readonly id: string; readonly name: string };

export function sameActor(a: Actor, b: Actor): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export function describeActor(actor: Actor): string {
  return actor.kind === "agent" ? `agent "${actor.name}"` : actor.name;
}
