/**
 * Who is acting on a task. An agent is known by the access token it presented,
 * so two agents sharing a token are one actor — which is what lets an agent
 * that lost its context claim its own task again.
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
