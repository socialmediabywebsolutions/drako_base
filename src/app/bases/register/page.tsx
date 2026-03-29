import { redirect } from "next/navigation";

type BasesRegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value[0] ?? null : null;
}

export default async function BasesRegisterPage({ searchParams }: BasesRegisterPageProps) {
  const params = (await searchParams) ?? {};
  const invite = resolveSearchParam(params.invite);
  const overrideHost = resolveSearchParam(params.__drako_host);
  const target = new URL("/bases/login", "http://localhost");
  if (invite) target.searchParams.set("invite", invite);
  if (overrideHost) target.searchParams.set("__drako_host", overrideHost);
  redirect(`${target.pathname}${target.search}`);
}
