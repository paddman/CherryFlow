import { PublishedApp } from "../../../components/PublishedApp";

export default async function PublishedAppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublishedApp slug={slug} />;
}
