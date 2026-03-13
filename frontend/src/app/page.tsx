"use client";

import { useState, useEffect } from "react";
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
  CheckCircle2
} from "lucide-react";
import { io } from "socket.io-client";
import { VAULT_ADDRESS, AutoTreasuryABI } from "@/lib/constants";

const SOCKET_URL = "http://localhost:3001";

export default function SmartSaveDashboard() {
  const { isConnected, address } = useAccount();

  // --- Dynamic Contract State ---
  // Using 0 as fallback values to show the UI structure even if disconnected
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

  const principalVal = userPrincipal ? parseFloat(formatEther(userPrincipal as bigint)) : 1240.50;
  const yieldVal = userYield ? parseFloat(formatEther(userYield as bigint)) : 42.80;

  // --- XCM Spending Handlers ---
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleSpendYield = (actionName: string, amount: string) => {
    setActiveAction(actionName);
    // Simulated XCM call to payWithYield.
    // In a real scenario, targetParaId, targetAsset, and precise amounts would be configured per action.
    writeContract({
      address: VAULT_ADDRESS as `0x${string}`,
      abi: AutoTreasuryABI.abi,
      functionName: "payWithYield",
      args: [1000, "0x9A676e781A523b5d0C0e43731313A708CB607508", parseEther(amount)],
    });
  };

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

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 relative">
      {/* Decorative Orbs */}
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex flex-col justify-end">
             {/* Simple visual replacement for the pink Piggy Bank logo */}
             <div className="relative w-10 h-10 bg-[#e6007a] rounded-full flex items-center justify-center -rotate-12 shadow-[0_0_15px_rgba(230,0,122,0.8)]">
                <PiggyBank className="text-white fill-white" size={24} />
                <div className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full"></div>
             </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white m-0">
              SmartSave
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Save once. Spend your yield. Your principal is protected.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {isConnected && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></span>
              Polkadot Hub Connected
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
            <span className="text-slate-200 font-medium">+ {isConnected ? "2.10" : "0.00"}</span> today
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Actions & Yield Sources) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Spend From Earnings Block */}
          <div className="glass-panel p-6">
            <h3 className="text-lg font-bold mb-1">Spend From Earnings</h3>
            <p className="text-sm text-slate-400 mb-6 flex justify-between items-center">
              <span>Available: <span className="text-white font-medium">${yieldVal.toFixed(2)}</span></span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div 
                className="action-row highlighted" 
                onClick={() => handleSpendYield("Pay utilities", "15")}
              >
                <div className="flex items-center gap-3">
                  <Zap size={18} className="text-amber-300 fill-amber-300" />
                  <span className="font-medium text-sm">Pay utilities</span>
                </div>
                {activeAction === "Pay utilities" && (isPending || isTxLoading) ? <RefreshCcw size={16} className="animate-spin text-white/50" /> : <ChevronRight size={16} className="text-white/30" />}
              </div>
              
              <div 
                className="action-row"
                onClick={() => handleSpendYield("Buy airtime", "5")}
              >
                <div className="flex items-center gap-3">
                  <Smartphone size={18} className="text-blue-300" />
                  <span className="font-medium text-sm">Buy airtime</span>
                </div>
                {activeAction === "Buy airtime" && (isPending || isTxLoading) ? <RefreshCcw size={16} className="animate-spin text-white/50" /> : <ChevronRight size={16} className="text-white/30" />}
              </div>

              <div 
                className="action-row"
                onClick={() => handleSpendYield("Transfer to wallet", "20")}
              >
                <div className="flex items-center gap-3">
                  <CreditCard size={18} className="text-purple-400" />
                  <span className="font-medium text-sm">Transfer to wallet</span>
                </div>
                {activeAction === "Transfer to wallet" && (isPending || isTxLoading) ? <RefreshCcw size={16} className="animate-spin text-white/50" /> : <ChevronRight size={16} className="text-white/30" />}
              </div>

              <div 
                className="action-row"
                onClick={() => handleSpendYield("Pay subscription", "10")}
              >
                <div className="flex items-center gap-3">
                  <RefreshCcw size={18} className="text-[#e6007a]" />
                  <span className="font-medium text-sm">Pay subscription</span>
                </div>
                {activeAction === "Pay subscription" && (isPending || isTxLoading) ? <RefreshCcw size={16} className="animate-spin text-white/50" /> : <ChevronRight size={16} className="text-white/30" />}
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 uppercase font-bold tracking-wider">
               <span className="w-1.5 h-1.5 bg-[#e6007a] rounded-full inline-block animate-pulse"></span>
               Funds allocated via XCM
            </div>
            
            {/* Transaction feedback */}
            {isTxSuccess && activeAction && activeAction !== "Save" && (
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle2 size={16} /> Paid with Yield successfully via XCM.
                </div>
            )}
          </div>

          {/* Yield Sources Block */}
          <div>
            <h3 className="text-sm font-bold mb-3">Yield Sources</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="glass-panel p-4 border-[#e6007a]/30 bg-[#e6007a]/5">
                 <div className="flex items-center gap-2 mb-1">
                   {/* Simulating moonbeam icon */}
                   <div className="w-5 h-5 rounded-full bg-gradient-to-b from-teal-400 to-indigo-500"></div>
                   <span className="font-bold text-sm">Moonbeam</span>
                 </div>
                 <div className="text-xs text-slate-400 ml-7">
                    APY <span className="text-white font-bold ml-1">8.4%</span>
                 </div>
              </div>

              <div className="glass-panel p-4">
                 <div className="flex items-center gap-2 mb-1">
                   {/* Simulating Astar icon */}
                   <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-600 flex items-center justify-center">
                     <div className="w-2 h-2 bg-white rounded-full"></div>
                   </div>
                   <span className="font-bold text-sm">Astar Liquidity</span>
                 </div>
                 <div className="text-xs text-slate-400 ml-7">
                    APY <span className="text-white font-bold ml-1">7.1%</span>
                 </div>
              </div>

              <div className="glass-panel p-4">
                 <div className="flex items-center gap-2 mb-1">
                   {/* Simulating HydraDX icon */}
                   <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
                      <span className="text-black text-[10px] font-black">H</span>
                   </div>
                   <span className="font-bold text-sm">HydraDX Vault</span>
                 </div>
                 <div className="text-xs text-slate-400 ml-7">
                    APY <span className="text-white font-bold ml-1">9.2%</span>
                 </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (Goals & Activity) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Savings Goal Panel */}
          <div className="glass-panel p-6">
            <h3 className="text-sm text-slate-400 font-medium mb-4">Savings Goal</h3>
            <div className="mb-4">
               <h4 className="font-bold text-lg mb-1">Laptop Fund</h4>
               <p className="text-sm flex items-center gap-1">
                  <span className="font-bold text-white">${Math.floor(principalVal).toLocaleString()}</span>
                  <span className="text-slate-500">/ $2,000</span>
               </p>
            </div>
            
            <div className="mb-2">
               <div className="progress-bar-bg">
                 <div className="progress-bar-fill" style={{ width: '62%' }}></div>
               </div>
            </div>
            <div className="text-right text-xs text-slate-400 mb-6">
               Progress: <span className="text-white font-medium">62%</span>
            </div>

            <div className="flex gap-2 mb-2">
              <input 
                 type="number" 
                 placeholder="0.00" 
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

          {/* Recent Activity */}
          <div>
            <h3 className="text-sm font-bold mb-3">Recent Activity</h3>
            <div className="glass-panel p-2">
              <div className="flex flex-col text-sm text-slate-300 divide-y divide-white/5">
                 
                 <div className="flex justify-between items-center py-3 px-3">
                   <div className="flex items-center gap-4">
                     <span className="text-slate-500 text-xs w-12">4.28.24</span>
                     <span>Saved <strong>$25</strong></span>
                   </div>
                   <span className="text-white font-medium">$25</span>
                 </div>

                 <div className="flex justify-between items-center py-3 px-3">
                   <div className="flex items-center gap-4">
                     <span className="text-slate-500 text-xs w-12">4.27.24</span>
                     <span className="text-emerald-400">Earned <strong>$1.12</strong> yield</span>
                   </div>
                   <span className="text-emerald-400 font-medium">$1.12</span>
                 </div>

                 <div className="flex justify-between items-center py-3 px-3">
                   <div className="flex items-center gap-4">
                     <span className="text-slate-500 text-xs w-12">4.28.24</span>
                     <span>Paid Netflix using yield</span>
                   </div>
                   <span className="text-white font-medium">$0.87</span>
                 </div>

                 <div className="flex justify-between items-center py-3 px-3">
                   <div className="flex items-center gap-4">
                     <span className="text-slate-500 text-xs w-12">4.26.24</span>
                     <span className="text-emerald-400">Earned <strong>$0.81</strong> yield</span>
                   </div>
                   <span className="text-emerald-400 font-medium">$0.81</span>
                 </div>

                 <div className="flex justify-between items-center py-3 px-3">
                   <div className="flex items-center gap-4">
                     <span className="text-slate-500 text-xs w-12">4.26.24</span>
                     <span>Saved <strong>$20</strong></span>
                   </div>
                   <span className="text-white font-medium">$20</span>
                 </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
