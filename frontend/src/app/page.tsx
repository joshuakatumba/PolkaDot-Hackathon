"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  useAccount, 
  useReadContract, 
  useWriteContract, 
  useWaitForTransactionReceipt
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { 
  PiggyBank, 
  ShieldCheck, 
  Sprout, 
  ChevronRight,
  Zap,
  Smartphone,
  CreditCard,
  RefreshCcw,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { io } from "socket.io-client";
import { VAULT_ADDRESS, AutoTreasuryABI } from "@/lib/constants";

const BACKEND_URL = "http://localhost:3001";

// Types from the backend API
interface Allocation {
  address: string;
  name: string;
  value: string;
  color: string;
  percentage: number;
}

interface ActivityItem {
  type: string;
  from?: string;
  to?: string;
  chain?: string;
  status?: string;
  timestamp?: number;
  user?: string;
  amount?: string;
  txHash?: string;
}

interface VaultStats {
  tvl: string;
  totalShares: string;
  sharePrice: string;
  apy: string;
  activeRoutes: number;
  allocations: Allocation[];
  activityFeed: ActivityItem[];
}

// Map allocation names to display info
const STRATEGY_DISPLAY: Record<string, { icon: React.ReactNode; gradient: string }> = {
  "Native DOT Staking (Relay)": {
    icon: <div className="w-5 h-5 rounded-full bg-gradient-to-b from-teal-400 to-indigo-500" />,
    gradient: "border-[#e6007a]/30 bg-[#e6007a]/5",
  },
  "DeFi USDC Lending (AssetHub)": {
    icon: (
      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-600 flex items-center justify-center">
        <div className="w-2 h-2 bg-white rounded-full" />
      </div>
    ),
    gradient: "",
  },
};

// Format a block number / timestamp into readable date
function formatTimestamp(ts?: number): string {
  if (!ts) return "—";
  // If ts looks like a block number (small number), just show it
  if (ts < 1_000_000) return `Block ${ts}`;
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
}

// Format activity row into human-readable label
function activityLabel(item: ActivityItem): { label: string; colorClass: string } {
  switch (item.type) {
    case "Deposit":
      return { label: `Saved${item.amount ? ` ${parseFloat(item.amount).toFixed(2)} DOT` : ""}`, colorClass: "text-slate-200" };
    case "Rebalance":
      return { label: "Yield Harvested", colorClass: "text-emerald-400" };
    case "YieldClaim":
      return { label: `Paid with yield${item.amount ? ` ${parseFloat(item.amount).toFixed(2)} DOT` : ""}`, colorClass: "text-slate-200" };
    case "System":
      return { label: "System Idle — Awaiting Activity", colorClass: "text-slate-500 italic" };
    default:
      return { label: item.type, colorClass: "text-slate-300" };
  }
}

export default function SmartSaveDashboard() {
  const { isConnected, address } = useAccount();

  // --- Backend Stats State ---
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [liveActivity, setLiveActivity] = useState<ActivityItem[]>([]);

  // Fetch stats from backend
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/vault/stats`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: VaultStats = await res.json();
      setStats(data);
      setLiveActivity(data.activityFeed || []);
    } catch (e) {
      console.error("Could not fetch vault stats:", e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch on mount and every 15 seconds
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // WebSocket: append live events to activity feed
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ["websocket"] });
    socket.on("vault_event", (event: ActivityItem) => {
      setLiveActivity((prev) => [event, ...prev].slice(0, 10));
    });
    return () => { socket.disconnect(); };
  }, []);

  // --- On-chain user data ---
  const { data: userPrincipal } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: AutoTreasuryABI.abi,
    functionName: "principal",
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  const { data: userYield } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: AutoTreasuryABI.abi,
    functionName: "spendableYield",
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  // Use on-chain data when connected, otherwise show TVL from backend
  const principalVal = userPrincipal
    ? parseFloat(formatEther(userPrincipal as bigint))
    : stats ? parseFloat(stats.tvl) : 0;
  const yieldVal = userYield
    ? parseFloat(formatEther(userYield as bigint))
    : 0;

  // Progress toward a $2000 goal (using principal)
  const SAVINGS_GOAL = 2000;
  const progressPct = Math.min(100, Math.round((principalVal / SAVINGS_GOAL) * 100));

  // --- XCM Spending Handlers ---
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [spendAmounts, setSpendAmounts] = useState<Record<string, string>>({});

  const toggleAction = (name: string) =>
    setExpandedAction(prev => (prev === name ? null : name));

  const handleSpendYield = (actionName: string) => {
    const amount = spendAmounts[actionName];
    if (!amount || parseFloat(amount) <= 0 || parseFloat(amount) > yieldVal) return;
    setActiveAction(actionName);
    writeContract({
      address: VAULT_ADDRESS as `0x${string}`,
      abi: AutoTreasuryABI.abi,
      functionName: "payWithYield",
      args: [1000, "0x9A676e781A523b5d0C0e43731313A708CB607508", parseEther(amount)],
    });
  };

  // Refetch after tx
  useEffect(() => {
    if (isTxSuccess) { fetchStats(); }
  }, [isTxSuccess, fetchStats]);

  // --- Deposit (Savings) Handler ---
  const [depositAmount, setDepositAmount] = useState("");
  const handleSave = () => {
    if (!depositAmount) return;
    setActiveAction("Save");
    writeContract({
      address: VAULT_ADDRESS as `0x${string}`,
      abi: AutoTreasuryABI.abi,
      functionName: "save",
      args: [parseEther(depositAmount)]
    });
  };

  // Build Yield Sources from backend allocations
  const yieldSources = stats?.allocations ?? [];

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 relative">
      {/* Decorative Orbs */}
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex flex-col justify-end">
             <div className="relative w-10 h-10 bg-[#e6007a] rounded-full flex items-center justify-center -rotate-12 shadow-[0_0_15px_rgba(230,0,122,0.8)]">
                <PiggyBank className="text-white fill-white" size={24} />
                <div className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full"></div>
             </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white m-0">SmartSave</h1>
            <p className="text-slate-400 text-sm mt-1">Save once. Spend your yield. Your principal is protected.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {isConnected && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></span>
              Polkadot Hub Connected
            </div>
          )}
          {stats && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
              TVL: {parseFloat(stats.tvl).toFixed(4)} DOT
            </div>
          )}
          <ConnectButton showBalance={false} chainStatus="icon" />
        </div>
      </header>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Total Savings (Principal) */}
        <div className="glass-panel highlight p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#e6007a]/20 to-transparent pointer-events-none"></div>
          <div className="flex items-center gap-2 mb-4 text-slate-300">
             <div className="p-1.5 bg-white/10 rounded-md"><PiggyBank size={16} /></div>
             <h2 className="text-sm font-semibold tracking-wide">Total Savings <span className="text-slate-500 font-normal">(Locked)</span></h2>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-3xl font-bold text-white">$</span>
            <span className="text-4xl font-bold text-white tracking-tight">{Math.floor(principalVal).toLocaleString()}</span>
            <span className="text-xl font-bold text-white/70">.{(principalVal % 1).toFixed(2).substring(2)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 w-fit px-2 py-1 rounded inline-flex">
            <ShieldCheck size={12} />
            Principal protected
          </div>
        </div>

        {/* Soft Staking Earnings (Yield) */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-4 text-slate-300">
             <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-md"><Sprout size={16} /></div>
             <h2 className="text-sm font-semibold tracking-wide">Soft Staking Earnings</h2>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-3xl font-bold text-emerald-400">$</span>
            <span className="text-4xl font-bold text-emerald-400 tracking-tight">{Math.floor(yieldVal).toLocaleString()}</span>
            <span className="text-xl font-bold text-emerald-400/70">.{(yieldVal % 1).toFixed(2).substring(2)}</span>
          </div>
          <div className="text-xs text-slate-400">
            {stats ? (
              <span className="text-slate-300">APY: <span className="text-emerald-400 font-semibold">{stats.apy}</span> &middot; {stats.activeRoutes} active strategy route{stats.activeRoutes !== 1 ? "s" : ""}</span>
            ) : (
              <span>Loading yield data...</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Spend From Earnings Block */}
          <div className="glass-panel p-6">
            <h3 className="text-lg font-bold mb-1">Spend From Earnings</h3>
            <p className="text-sm text-slate-400 mb-6 flex justify-between items-center">
              <span>Available: <span className="text-white font-medium">{yieldVal.toFixed(4)} DOT</span></span>
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {([
                { name: "Pay utilities",     icon: <Zap size={18} className="text-amber-300 fill-amber-300" />, highlighted: true  },
                { name: "Buy airtime",        icon: <Smartphone size={18} className="text-blue-300" />,           highlighted: false },
                { name: "Transfer to wallet", icon: <CreditCard size={18} className="text-purple-400" />,         highlighted: false },
                { name: "Pay subscription",   icon: <RefreshCcw size={18} className="text-[#e6007a]" />,          highlighted: false },
              ] as const).map(({ name, icon, highlighted }) => {
                const isOpen   = expandedAction === name;
                const isActive = activeAction === name && (isPending || isTxLoading);
                const val      = spendAmounts[name] ?? "";
                const over     = parseFloat(val) > yieldVal;
                return (
                  <div key={name} className="rounded-xl border border-white/10 overflow-hidden">
                    <div
                      className={`action-row !rounded-none border-0 cursor-pointer ${highlighted ? "highlighted" : ""}`}
                      onClick={() => toggleAction(name)}
                    >
                      <div className="flex items-center gap-3">{icon}<span className="font-medium text-sm">{name}</span></div>
                      {isActive
                        ? <RefreshCcw size={16} className="animate-spin text-white/50" />
                        : <ChevronRight size={16} className={`transition-transform text-white/30 ${isOpen ? "rotate-90" : ""}`} />
                      }
                    </div>
                    {isOpen && (
                      <div className="px-3 py-2 bg-white/5 border-t border-white/10 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="0" step="0.0001"
                            placeholder={`Max ${yieldVal.toFixed(4)} DOT`}
                            value={val}
                            onChange={e => setSpendAmounts(p => ({ ...p, [name]: e.target.value }))}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#e6007a]"
                          />
                          <span className="text-xs text-slate-400 shrink-0">DOT</span>
                          <button
                            onClick={() => handleSpendYield(name)}
                            disabled={!isConnected || !val || over || isActive}
                            className="btn-primary text-xs px-4 py-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isActive ? "Sending…" : "Send"}
                          </button>
                        </div>
                        {over && <p className="text-xs text-red-400">Exceeds available yield ({yieldVal.toFixed(4)} DOT)</p>}
                        {!isConnected && <p className="text-xs text-slate-500">Connect your wallet to send</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 uppercase font-bold tracking-wider">
               <span className="w-1.5 h-1.5 bg-[#e6007a] rounded-full inline-block animate-pulse"></span>
               Funds allocated via XCM
            </div>
            
            {isTxSuccess && activeAction && activeAction !== "Save" && (
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle2 size={16} /> Paid with Yield successfully via XCM.
                </div>
            )}
          </div>

          {/* Yield Sources — DYNAMIC from backend allocations */}
          <div>
            <h3 className="text-sm font-bold mb-3">Yield Sources</h3>
            {statsLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
                <Loader2 size={16} className="animate-spin" /> Loading strategies...
              </div>
            ) : yieldSources.length === 0 ? (
              <div className="glass-panel p-4 text-slate-400 text-sm">No strategies deployed yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {yieldSources.map((s) => {
                  const display = STRATEGY_DISPLAY[s.name];
                  const apy = s.percentage > 0 ? `${s.percentage.toFixed(1)}%` : "—";
                  return (
                    <div key={s.address} className={`glass-panel p-4 ${display?.gradient ?? ""}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {display?.icon ?? <div className="w-5 h-5 rounded-full bg-gradient-to-b from-slate-400 to-slate-600" />}
                        <span className="font-bold text-sm truncate">{s.name}</span>
                      </div>
                      <div className="text-xs text-slate-400 ml-7">
                        Allocated <span className="text-white font-bold ml-1">{parseFloat(s.value).toFixed(4)} DOT</span>
                      </div>
                      <div className="text-xs text-slate-500 ml-7 mt-0.5">
                        {s.percentage > 0 ? `${s.percentage}% of portfolio` : "0% (idle)"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Savings Goal Panel */}
          <div className="glass-panel p-6">
            <h3 className="text-sm text-slate-400 font-medium mb-4">Savings Goal</h3>
            <div className="mb-4">
               <h4 className="font-bold text-lg mb-1">Laptop Fund</h4>
               <p className="text-sm flex items-center gap-1">
                  <span className="font-bold text-white">{principalVal.toFixed(2)} DOT</span>
                  <span className="text-slate-500">/ {SAVINGS_GOAL} DOT</span>
               </p>
            </div>
            
            <div className="mb-2">
               <div className="progress-bar-bg">
                 <div className="progress-bar-fill transition-all duration-700" style={{ width: `${progressPct}%` }}></div>
               </div>
            </div>
            <div className="text-right text-xs text-slate-400 mb-6">
               Progress: <span className="text-white font-medium">{progressPct}%</span>
            </div>

            <div className="flex gap-2 mb-2">
              <input 
                 type="number" 
                 placeholder="0.00 DOT" 
                 value={depositAmount} 
                 onChange={(e) => setDepositAmount(e.target.value)}
                 className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#e6007a]"
              />
            </div>
            <button 
              className="btn-primary w-full text-sm"
              onClick={handleSave}
              disabled={!isConnected || isPending || isTxLoading || !depositAmount}
            >
              {activeAction === "Save" && (isPending || isTxLoading) ? "Adding..." : "Add Savings"}
            </button>
            {isTxSuccess && activeAction === "Save" && (
                <div className="mt-2 text-center text-xs text-emerald-400">Successfully added to savings!</div>
            )}
          </div>

          {/* Recent Activity — DYNAMIC via API + WebSocket */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Recent Activity</h3>
              {statsLoading && <Loader2 size={12} className="animate-spin text-slate-500" />}
            </div>
            <div className="glass-panel p-2">
              <div className="flex flex-col text-sm text-slate-300 divide-y divide-white/5">
                {liveActivity.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs">No activity yet. Make a deposit to get started!</div>
                ) : (
                  liveActivity.map((item, i) => {
                    const { label, colorClass } = activityLabel(item);
                    const amountDisplay = item.amount ? `${parseFloat(item.amount).toFixed(4)} DOT` : "";
                    return (
                      <div key={i} className="flex justify-between items-center py-3 px-3">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-16 shrink-0">{formatTimestamp(item.timestamp)}</span>
                          <span className={colorClass}>{label}</span>
                        </div>
                        {amountDisplay && (
                          <span className={`font-medium shrink-0 ${item.type === "Rebalance" || item.type === "YieldClaim" ? "text-emerald-400" : "text-white"}`}>
                            {amountDisplay}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
