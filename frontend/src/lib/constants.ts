import AutoTreasuryABI from "../abi/AutoTreasury.json";
import XCMRouterABI from "../abi/XCMRouter.json";

export const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
export const ROUTER_ADDRESS = process.env.NEXT_PUBLIC_ROUTER_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

export const SUPPORTED_ASSETS = [
  {
    symbol: "DOT",
    name: "Polkadot",
    address: process.env.NEXT_PUBLIC_DOT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    icon: "data:image/svg+xml,%3Csvg%20width%3D%22200%22%20height%3D%22200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%22100%22%20cy%3D%22100%22%20r%3D%22100%22%20fill%3D%22%23E6007A%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22central%22%20font-family%3D%22sans-serif%22%20font-weight%3D%22bold%22%20font-size%3D%2260%22%20fill%3D%22white%22%3EDOT%3C%2Ftext%3E%3C%2Fsvg%3E",
    color: "#E6007A",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: process.env.NEXT_PUBLIC_USDC_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    icon: "data:image/svg+xml,%3Csvg%20width%3D%22200%22%20height%3D%22200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%22100%22%20cy%3D%22100%22%20r%3D%22100%22%20fill%3D%22%232775CA%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22central%22%20font-family%3D%22sans-serif%22%20font-weight%3D%22bold%22%20font-size%3D%2250%22%20fill%3D%22white%22%3EUSDC%3C%2Ftext%3E%3C%2Fsvg%3E",
    color: "#2775CA",
  },
  {
    symbol: "PINK",
    name: "PINK Token",
    address: process.env.NEXT_PUBLIC_PINK_ADDRESS || "0x0000000000000000000000000000000000000000",
    icon: "data:image/svg+xml,%3Csvg%20width%3D%22200%22%20height%3D%22200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%22100%22%20cy%3D%22100%22%20r%3D%22100%22%20fill%3D%22%23FF007A%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22central%22%20font-family%3D%22sans-serif%22%20font-weight%3D%22bold%22%20font-size%3D%2250%22%20fill%3D%22white%22%3EPINK%3C%2Ftext%3E%3C%2Fsvg%3E",
    color: "#FF007A",
  },
];

export { AutoTreasuryABI, XCMRouterABI };
