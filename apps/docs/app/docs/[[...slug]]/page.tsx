import { source } from "@/lib/source";
import { getMDXComponents } from "@/components/mdx";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return [{ slug: [] }, ...source.generateParams()];
}

export default async function Page({ params }: PageProps<"/docs/[[...slug]]">) {
  const { slug } = await params;
  const page = source.getPage(slug?.length ? slug : ["guides", "README"]);
  if (!page) notFound();

  const MDX = page.data.body;
  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}
