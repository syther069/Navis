import {
  Broadcast,
  CheckCircle,
  CircleNotch,
  Flask,
  HourglassMedium,
  PenNib,
  Prohibit,
  Wrench,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";

/**
 * The nine presentation states of a transaction. Every screen that shows a
 * transaction maps its real recorded status onto one of these; a state is
 * never shown unless the record supports it.
 */
export type TransactionState =
  | "preparing"
  | "simulation"
  | "awaiting_wallet"
  | "signing"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed"
  | "blocked";

export const TRANSACTION_STATE_ORDER: readonly TransactionState[] = [
  "preparing",
  "simulation",
  "awaiting_wallet",
  "signing",
  "submitted",
  "confirming",
  "confirmed",
  "failed",
  "blocked",
];

export const TRANSACTION_STATE_META: Record<
  TransactionState,
  { label: string; description: string; icon: typeof CheckCircle; terminal: boolean }
> = {
  preparing: {
    label: "Preparing",
    description: "Unsigned transaction being built. No value has moved.",
    icon: Wrench,
    terminal: false,
  },
  simulation: {
    label: "Simulation",
    description: "Simulated against the network only. Not signed, not sent.",
    icon: Flask,
    terminal: false,
  },
  awaiting_wallet: {
    label: "Awaiting wallet",
    description: "Waiting for your wallet to review and sign.",
    icon: HourglassMedium,
    terminal: false,
  },
  signing: {
    label: "Signing",
    description: "Wallet signature in progress.",
    icon: PenNib,
    terminal: false,
  },
  submitted: {
    label: "Submitted",
    description: "Signed and sent to the network. Not yet confirmed.",
    icon: Broadcast,
    terminal: false,
  },
  confirming: {
    label: "Confirming",
    description: "Seen by the network, waiting for the required commitment.",
    icon: CircleNotch,
    terminal: false,
  },
  confirmed: {
    label: "Confirmed",
    description: "Confirmed onchain. The signature is verifiable in an explorer.",
    icon: CheckCircle,
    terminal: true,
  },
  failed: {
    label: "Failed",
    description: "Attempted and failed. The recorded error explains why.",
    icon: XCircle,
    terminal: true,
  },
  blocked: {
    label: "Blocked",
    description: "Refused before signing by policy, configuration or provider.",
    icon: Prohibit,
    terminal: true,
  },
};

export function TransactionStateBadge({ state }: { state: TransactionState }) {
  const meta = TRANSACTION_STATE_META[state];
  const Icon = meta.icon;
  return (
    <span className="tx-state" data-state={state} title={meta.description}>
      <Icon aria-hidden="true" size={13} weight="bold" />
      <span>{meta.label}</span>
    </span>
  );
}
