import { redirect } from "next/navigation";

/**
 * There is no home page of its own: the repository table is the dashboard,
 * and it shows the sign-in panel to anyone signed out.
 */
export default function Home(): never {
  redirect("/repositories");
}
