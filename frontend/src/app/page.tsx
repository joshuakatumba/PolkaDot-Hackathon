"use client";

import { useState, useEffect } from "react";
import { 
  useAccount, 
  useReadContract, 
  useWriteContract, 
  useWaitForTransactionReceipt,
  useBalance
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Activity, 
  TrendingUp, 
  ShieldCheck,
  Zap,
  RefreshCcw,
  ArrowRight,
  Info
} from "lucide-react";
import { io } from "socket.io-client";
import { VAULT_ADDRESS, SUPPORTED_ASSETS, AutoTreasuryABI } from "@/lib/constants";

const SOCKET_URL = "http://localhost:3001";

export default function Dashboard() {
  const { isConnected, address } = useAccount();
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [selectedAsset, setSelectedAsset] = useState(SUPPORTED_ASSETS[0]);
  const [amount, setAmount] = useState("");

  // --- Dynamic Backend State ---
  const [vaultStats, setVaultStats] = useState<any>({
    tvl: "0",
    totalShares: "0",
    sharePrice: "0",
    apy: "12.45%",
    activeRoutes: 0,
  });

  const [allocations, setAllocations] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  // WebSocket / Polling Effect
  useEffect(() => {
    const socket = io(SOCKET_URL);

    const fetchStats = async () => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/vault/stats`);
        if (res.ok) {
          const data = await res.json();
          setVaultStats(data);
          setAllocations(data.allocations || []);
          setActivityFeed(data.activityFeed || []);
        }
      } catch (err) {
        console.error("Failed to fetch backend stats:", err);
      }
    };

    fetchStats();

    // Listen for real-time events from backend
    socket.on("vault_event", (data) => {
      console.log("WebSocket Event:", data);
      
      // Update feed immediately
      setActivityFeed(prev => [
        {
          type: data.type,
          from: data.user ? data.user.slice(0, 6) + '...' : 'System',
          to: data.type === 'Rebalance' ? 'Strategies' : 'Vault',
          chain: data.type === 'Rebalance' ? 'Multi-Chain' : 'Westend Asset Hub',
          status: 'Finalized',
          timestamp: Date.now()
        },
        ...prev.slice(0, 4)
      ]);

      // Refresh stats after a delay to allow for block propagation
      setTimeout(fetchStats, 2000);
    });

    socket.on("connected", (data) => {
      console.log("Socket connected:", data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // --- Contract Reads ---
  const { data: totalShares } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: AutoTreasuryABI.abi,
    functionName: "totalShares",
  });

  const { data: totalAssets } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: AutoTreasuryABI.abi,
    functionName: "totalAssets",
  });

  const { data: userShares } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: AutoTreasuryABI.abi,
    functionName: "shares",
    args: [address],
  });

  const { data: sharePrice } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: AutoTreasuryABI.abi,
    functionName: "sharePrice",
  });

  // --- Contract Writes ---
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash });

  const handleDeposit = () => {
    if (!amount) return;
    writeContract({
      address: VAULT_ADDRESS as `0x${string}`,
      abi: AutoTreasuryABI.abi,
      functionName: "deposit",
      args: [selectedAsset.address, parseEther(amount)],
    });
  };

  const handleWithdraw = () => {
    if (!amount) return;
    writeContract({
      address: VAULT_ADDRESS as `0x${string}`,
      abi: AutoTreasuryABI.abi,
      functionName: "withdraw",
      args: [parseEther(amount)],
    });
  };

  // --- Derived State ---
  // We prefer the backend's TVL, but fallback to direct contract read if available
  const tvl = vaultStats.tvl !== "0" ? vaultStats.tvl : (totalAssets ? formatEther(totalAssets as bigint) : "0");
  const userBal = userShares && sharePrice 
    ? formatEther(((userShares as bigint) * (sharePrice as bigint)) / parseEther("1")) 
    : "0";

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#e6007a] rounded-full flex items-center justify-center animate-pulse">
            <Zap className="text-white fill-white" size={20} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Auto<span className="text-[#e6007a]">Treasury</span>
          </h1>
        </div>
        <ConnectButton showBalance={false} chainStatus="name" />
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="stat-card">
          <p className="text-slate-400 text-sm font-medium mb-1 flex items-center justify-between">
            Total Value Locked
            <span className={`w-2 h-2 rounded-full ${vaultStats.tvl !== "0" ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} title="Live updates active"></span>
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold font-inter">${parseFloat(tvl).toLocaleString()}</h2>
            <span className="text-emerald-400 text-sm font-medium">+12.4%</span>
          </div>
        </div>
        <div className="stat-card">
          <p className="text-slate-400 text-sm font-medium mb-1">Current APY</p>
          <h2 className="text-3xl font-bold text-[#e6007a] font-inter">{vaultStats.apy || "18.5%"}</h2>
        </div>
        <div className="stat-card">
          <p className="text-slate-400 text-sm font-medium mb-1">Your Balance</p>
          <h2 className="text-3xl font-bold font-inter">${parseFloat(userBal).toLocaleString()}</h2>
        </div>
        <div className="stat-card">
          <p className="text-slate-400 text-sm font-medium mb-1">Active XCM Routes</p>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-bold font-inter">{vaultStats.activeRoutes || "2"}</h2>
            <RefreshCcw className="text-slate-500 animate-spin-slow" size={16} />
          </div>
        </div>
      </div>

      {/* Track 2 Highlight Section */}
      <div className="glass-panel p-6 mb-12 border-[#e6007a]/20 bg-[#e6007a]/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <ShieldCheck size={120} className="text-[#e6007a]" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-[#e6007a] text-white text-[10px] font-bold rounded uppercase tracking-widest">Track 2: PVM</span>
              <h3 className="text-xl font-bold">Hybrid Yield Engine Active</h3>
            </div>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Your assets are automatically split between <strong>Native Relay Staking</strong> (utilizing the PVM Staking Precompile for maximum security/yield) and <strong>AssetHub Lending</strong> (for instant liquidity via XCM).
            </p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-center p-3 rounded-xl bg-white/5 border border-white/10 min-w-32">
                <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">Staking APY</span>
                <span className="text-lg font-bold text-[#e6007a]">17.2%</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-xl bg-white/5 border border-white/10 min-w-32">
                <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">XCM Latency</span>
                <span className="text-lg font-bold">~12s</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Interaction Panel */}
        <div className="lg:col-span-7">
          <div className="glass-panel overflow-hidden">
            <div className="flex border-b border-white/10">
              <button 
                onClick={() => setActiveTab("deposit")}
                className={`flex-1 py-4 font-semibold transition-all ${activeTab === "deposit" ? "bg-white/5 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                Deposit
              </button>
              <button 
                onClick={() => setActiveTab("withdraw")}
                className={`flex-1 py-4 font-semibold transition-all ${activeTab === "withdraw" ? "bg-white/5 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                Withdraw
              </button>
            </div>
            
            <div className="p-8">
              <div className="mb-6">
                <label className="block text-slate-400 text-sm font-medium mb-3">Select Asset</label>
                <div className="grid grid-cols-3 gap-4">
                  {SUPPORTED_ASSETS.map((asset) => (
                    <button
                      key={asset.symbol}
                      onClick={() => setSelectedAsset(asset)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                        selectedAsset.symbol === asset.symbol 
                        ? "border-[#e6007a] bg-[#e6007a]/10" 
                        : "border-white/5 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <img src={asset.icon} alt={asset.symbol} className="w-8 h-8" />
                      <span className="font-bold">{asset.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-slate-400 text-sm font-medium mb-3">Amount</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="input-field pr-20"
                  />
                  <button className="absolute right-4 top-1/2 -translate-y-1/2 text-[#e6007a] font-bold text-sm hover:text-[#ff0088]">
                    MAX
                  </button>
                </div>
              </div>

              <button 
                onClick={activeTab === "deposit" ? handleDeposit : handleWithdraw}
                disabled={!isConnected || isWritePending || isTxLoading || !amount}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isWritePending || isTxLoading ? (
                  <RefreshCcw className="animate-spin" size={20} />
                ) : activeTab === "deposit" ? (
                  <><ArrowUpCircle size={20} /> Deposit Assets</>
                ) : (
                  <><ArrowDownCircle size={20} /> Withdraw Shares</>
                )}
              </button>

                <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-400">
                  <ShieldCheck size={20} />
                  <div>
                    <p className="text-sm font-medium">Transaction confirmed! XCM instructions sent.</p>
                    {hash && (
                      <a 
                        href={`https://assethub-westend.statescan.io/#/txs/${hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline hover:text-emerald-300 transition-colors"
                      >
                        View transaction
                      </a>
                    )}
                  </div>
                </div>
            </div>
          </div>
        </div>

        {/* Info & Activity Sidebar */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          {/* Portfolio Allocation */}
          <div className="glass-panel p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-[#e6007a]" />
                Strategy Allocation
              </div>
              <Info size={16} className="text-slate-500 cursor-help hover:text-slate-300" />
            </h3>
            <div className="space-y-6">
              {allocations.map((alloc, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-slate-400 font-inter">{alloc.name}</span>
                    <span className="text-sm font-bold">{alloc.percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full transition-all duration-1000 ease-out" 
                      style={{ 
                        width: `${alloc.percentage}%`, 
                        backgroundColor: alloc.color,
                        boxShadow: alloc.color === "#E6007A" ? "0 0 10px rgba(230,0,122,0.5)" : "none"
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
              <p>Network Status: <span className="text-emerald-400 font-bold uppercase tracking-tighter">Connected</span></p>
              <a 
                href={`https://assethub-westend.statescan.io/#/accounts/${VAULT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#e6007a] hover:underline transition-colors"
              >
                Contract Explorer
              </a>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="glass-panel p-6 flex-1">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Activity size={20} className="text-slate-400" />
              Live XCM Activity
            </h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {activityFeed.length > 0 ? activityFeed.map((item, i) => (
                <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{item.type}</span>
                    <span className="text-sm font-medium flex items-center gap-1">
                      {item.from} <ArrowRight className="text-slate-600" size={10} /> {item.to}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] font-medium text-[#e6007a] mb-1 uppercase opacity-75">{item.chain}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${item.status === 'Finalized' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              )) : (
                <p className="text-center text-slate-500 text-sm py-12">No activity detected yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
