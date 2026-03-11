"use client";
import { 
  RainbowKitProvider, 
  darkTheme,
  getDefaultWallets,
  connectorsForWallets
} from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import * as React from "react";
import "@rainbow-me/rainbowkit/styles.css";
import { type Chain } from "viem";

const westendAssetHub: Chain = {
  id: 420420421,
  name: "Westend Asset Hub",
  nativeCurrency: { name: "Westend", symbol: "WND", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://westend-asset-hub-eth-rpc.polkadot.io"] },
    public: { http: ["https://westend-asset-hub-eth-rpc.polkadot.io"] },
  },
  blockExplorers: {
    default: { name: "Subscan", url: "https://westend.subscan.io" },
  },
};

const { wallets } = getDefaultWallets({
  appName: "XCM AutoTreasury",
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID || "87400789507c973661f05dd3cf4a71f0",
});

const connectors = connectorsForWallets(wallets, {
  appName: "XCM AutoTreasury",
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID || "87400789507c973661f05dd3cf4a71f0",
});

const config = createConfig({
  connectors,
  chains: [mainnet, westendAssetHub],
  transports: {
    [mainnet.id]: http(),
    [westendAssetHub.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
