import { pgSchema } from "drizzle-orm/pg-core";

// Production shares its database with Flexi Day, which owns `public` and
// `drizzle`; a schema of our own keeps the two apps from colliding.
export const fenro = pgSchema("fenro");
