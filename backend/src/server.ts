import express, { Request, Response } from "express";
import cors from "cors";
import { ethers } from "ethers";
import { createServer } from "http";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import AutoTreasuryABI from "./abi/AutoTreasury.json";
import YieldStrategyABI from "./abi/YieldStrategy.json";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// Supabase Init
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";
const supabase = (supabaseUrl && supabaseKey && !supabaseUrl.includes("YOUR_SUPABASE")) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

app.use(cors());
app.use(express.json());

// RPC Config
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const vault = new ethers.Contract(VAULT_ADDRESS, AutoTreasuryABI.abi, provider);

// WebSocket Connection
io.on("connection", (socket) => {
  console.log("Client connected via WebSocket:", socket.id);
  socket.emit("connected", { status: "ready" });
});

// Real-time Event Listeners
vault.on("Deposited", async (user: string, asset: string, amount: bigint, shares: bigint, event: any) => {
  console.log(`[Event] Deposited: ${user} - ${ethers.formatEther(amount)}`);
  const data = { 
    type: "Deposit", 
    user, 
    asset, 
    amount: ethers.formatEther(amount), 
    txHash: event.log.transactionHash 
  };
  io.emit("vault_event", data);
  if (supabase) {
    supabase.from("vault_activity").insert([data]).then(({ error }) => {
      if (error) console.error("Supabase Error:", error);
    });
  }
});

vault.on("Rebalanced", async (timestamp: bigint, event: any) => {
  console.log(`[Event] Rebalanced at ${new Date(Number(timestamp) * 1000).toISOString()}`);
  const data = { 
    type: "Rebalance", 
    timestamp: Number(timestamp), 
    txHash: event.log.transactionHash 
  };
  io.emit("vault_event", data);
  if (supabase) {
    supabase.from("vault_activity").insert([data]).then(({ error }) => {
      if (error) console.error("Supabase Error:", error);
    });
  }
});

vault.on("YieldClaimed", async (user: string, amount: bigint, event: any) => {
  console.log(`[Event] YieldClaimed: ${user} - ${ethers.formatEther(amount)}`);
  const data = { 
    type: "YieldClaim", 
    user, 
    amount: ethers.formatEther(amount), 
    txHash: event.log.transactionHash 
  };
  io.emit("vault_event", data);
  if (supabase) {
    supabase.from("vault_activity").insert([data]).then(({ error }) => {
      if (error) console.error("Supabase Error:", error);
    });
  }
});

app.get("/", (req: Request, res: Response) => {
  res.send("<h1>AutoTreasury Backend is running</h1><p>API Endpoint: <a href='/api/vault/stats'>/api/vault/stats</a></p>");
});

app.get("/api/vault/stats", async (req: Request, res: Response) => {
  try {
    const [totalAssets, totalShares, sharePrice, strategyCountBig] = await Promise.all([
      vault.totalAssets(),
      vault.totalShares(),
      vault.sharePrice(),
      vault.strategyCount(),
    ]);

    const strategyCount = Number(strategyCountBig);
    const allocations = [];
    let totalInvestedValue = 0n;

    // Fetch allocation data from strategies
    for (let i = 0; i < strategyCount; i++) {
        try {
            const strategyAddr = await vault.strategies(i);
            
            // i=0 is NativeStakingStrategy, i=1 is AssetHubLendingStrategy
            // In a production app, we would query the strategy contract for its type/name.
            let name = `Strategy ${i}`;
            let color = "#94a3b8";
            let abi = YieldStrategyABI.abi; // Base ABI
            
            if (i === 0) { 
                name = "Native DOT Staking (Relay)"; 
                color = "#E6007A"; 
                // We'll use the base YieldStrategy ABI since it has totalValue()
            }
            if (i === 1) { 
                name = "DeFi USDC Lending (AssetHub)"; 
                color = "#2775CA"; 
            }

            const strategyContract = new ethers.Contract(strategyAddr, abi, provider);
            const val = await strategyContract.totalValue().catch(() => 0n);
            totalInvestedValue += val;

            allocations.push({
                address: strategyAddr,
                name,
                value: ethers.formatEther(val),
                color
            });
        } catch (e) {
            console.error(`Error fetching strategy ${i}:`, e);
        }
    }

    // Calculate percentages
    const finalAllocations = allocations.map(a => {
        const valBig = ethers.parseEther(a.value);
        const percentage = totalInvestedValue > 0n 
            ? Number((valBig * 100n) / totalInvestedValue)
            : 0;
        return {
            ...a,
            percentage
        };
    });

    // Fetch real events for activity feed (last 1000 blocks to be safe and fast)
    const blockNumber = await provider.getBlockNumber();
    const startBlock = Math.max(0, blockNumber - 1000);
    
    const [deposits, rebalances] = await Promise.all([
      vault.queryFilter(vault.filters.Deposited(), startBlock, blockNumber),
      vault.queryFilter(vault.filters.Rebalanced(), startBlock, blockNumber),
    ]);

    const activityFeed = [
      ...deposits.map(e => ({
        type: 'Deposit',
        from: (e as any).args.user.slice(0, 6) + '...',
        to: 'Vault',
        chain: 'Westend Asset Hub',
        status: 'Finalized',
        timestamp: (e as any).blockNumber
      })),
      ...rebalances.map(e => ({
        type: 'Rebalance',
        from: 'Treasury Admin',
        to: 'Strategies',
        chain: 'Multi-Chain',
        status: 'Finalized',
        timestamp: (e as any).blockNumber
      }))
    ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

    if (activityFeed.length === 0) {
      activityFeed.push({
        type: 'System',
        from: 'Network',
        to: 'Idle',
        chain: 'Polkadot',
        status: 'Operational'
      } as any);
    }

    res.json({
      tvl: ethers.formatEther(totalAssets),
      totalShares: ethers.formatEther(totalShares),
      sharePrice: ethers.formatEther(sharePrice),
      apy: "12.45%", // Real APY logic would go here
      activeRoutes: strategyCount,
      allocations: finalAllocations,
      activityFeed
    });
  } catch (error) {
    console.error("Vault Stats Error:", error);
    res.status(500).json({ error: "Failed to fetch vault statistics" });
  }
});

httpServer.listen(port, () => {
  console.log(`Backend API & WebSocket Server running at http://localhost:${port}`);
});
