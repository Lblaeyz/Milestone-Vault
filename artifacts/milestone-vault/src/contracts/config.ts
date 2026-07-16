import { type Chain } from "viem";

// ── Monad Testnet chain definition ─────────────────────────────────────────
export const monadTestnet: Chain = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"],
    },
    public: {
      http: ["https://testnet-rpc.monad.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "MonadScan",
      url: "https://testnet.monadscan.com",
    },
  },
  testnet: true,
};

// ── Contract addresses ──────────────────────────────────────────────────────
export const FACTORY_ADDRESS = (
  import.meta.env.VITE_FACTORY_ADDRESS || ""
) as `0x${string}`;

export const ARBITER_ADDRESS = (
  import.meta.env.VITE_ARBITER_ADDRESS ||
  "0x5a554d0b250Ec2fFd0796EBE053C1C2890A011dE"
) as `0x${string}`;

// ── Status enums (match Solidity) ───────────────────────────────────────────
export enum AgreementStatus {
  Created   = 0,
  Funded    = 1,
  Active    = 2,
  Completed = 3,
  Disputed  = 4,
}

export enum MilestoneStatus {
  Pending   = 0,
  Requested = 1,
  Approved  = 2,
  Rejected  = 3,
}

export enum RequestType {
  Milestone = 0,
  AdHoc     = 1,
}

export enum RequestStatus {
  Pending  = 0,
  Approved = 1,
  Rejected = 2,
  Disputed = 3,
}

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  [AgreementStatus.Created]:   "Created",
  [AgreementStatus.Funded]:    "Funded",
  [AgreementStatus.Active]:    "Active",
  [AgreementStatus.Completed]: "Completed",
  [AgreementStatus.Disputed]:  "Disputed",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  [MilestoneStatus.Pending]:   "Pending",
  [MilestoneStatus.Requested]: "Requested",
  [MilestoneStatus.Approved]:  "Approved",
  [MilestoneStatus.Rejected]:  "Rejected",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.Pending]:  "Pending",
  [RequestStatus.Approved]: "Approved",
  [RequestStatus.Rejected]: "Rejected",
  [RequestStatus.Disputed]: "Disputed",
};
