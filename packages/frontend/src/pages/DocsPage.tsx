import type { Address } from "viem";
import { useNavigate } from "react-router-dom";
import DocumentationPage from "../components/DocumentationPage";

interface Props {
  address: Address | null;
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
}

export function DocsPage({ address, onConnect }: Props) {
  const navigate = useNavigate();

  return (
    <DocumentationPage
      isConnected={Boolean(address)}
      onBack={() => navigate(address ? "/vaults" : "/home")}
      onConnect={onConnect}
    />
  );
}
