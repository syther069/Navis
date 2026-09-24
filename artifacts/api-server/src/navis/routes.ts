import * as route0 from "./api/agents/[slug]/clawpump-link/route";
import * as route1 from "./api/agents/[slug]/route";
import * as route2 from "./api/agents/route";
import * as route3 from "./api/assets/prestocks/route";
import * as route4 from "./api/auth/nonce/route";
import * as route5 from "./api/auth/session/route";
import * as route6 from "./api/auth/verify/route";
import * as route7 from "./api/decisions/[decisionId]/route";
import * as route8 from "./api/decisions/run/route";
import * as route9 from "./api/health/route";
import * as route10 from "./api/integrations/clawpump/agents/route";
import * as route11 from "./api/integrations/clawpump/launch/preflight/route";
import * as route12 from "./api/integrations/clawpump/verification/route";
import * as route13 from "./api/integrations/meteora/config/confirm/route";
import * as route14 from "./api/integrations/meteora/config/prepare/route";
import * as route15 from "./api/integrations/meteora/config/simulate/route";
import * as route16 from "./api/integrations/meteora/config/submit/route";
import * as route17 from "./api/integrations/meteora/launches/route";
import * as route18 from "./api/integrations/meteora/pool/prepare/route";
import * as route19 from "./api/integrations/meteora/pool/simulate/route";
import * as route20 from "./api/integrations/meteora/pool/submit/route";
import * as route21 from "./api/integrations/meteora/pools/[baseMint]/route";
import * as route22 from "./api/solana/slot/route";

export const originalRoutes = [
  ["/agents/:slug/clawpump-link", route0],
  ["/agents/:slug", route1],
  ["/agents", route2],
  ["/assets/prestocks", route3],
  ["/auth/nonce", route4],
  ["/auth/session", route5],
  ["/auth/verify", route6],
  ["/decisions/:decisionId", route7],
  ["/decisions/run", route8],
  ["/health", route9],
  ["/integrations/clawpump/agents", route10],
  ["/integrations/clawpump/launch/preflight", route11],
  ["/integrations/clawpump/verification", route12],
  ["/integrations/meteora/config/confirm", route13],
  ["/integrations/meteora/config/prepare", route14],
  ["/integrations/meteora/config/simulate", route15],
  ["/integrations/meteora/config/submit", route16],
  ["/integrations/meteora/launches", route17],
  ["/integrations/meteora/pool/prepare", route18],
  ["/integrations/meteora/pool/simulate", route19],
  ["/integrations/meteora/pool/submit", route20],
  ["/integrations/meteora/pools/:baseMint", route21],
  ["/solana/slot", route22],
] as const;
