import type { Address } from "viem";
import DocumentationPage from "../components/DocumentationPage";

interface Props {
  address: Address | null;
}

export function DocsPage({ address }: Props) {
  return <DocumentationPage isConnected={Boolean(address)} />;
}
