import customBackfill from "../../helpers/customBackfill";
import {
  DEFAULT_TOTAL_VOLUME_FACTORY,
  DEFAULT_TOTAL_VOLUME_FIELD,
  DEFAULT_DAILY_VOLUME_FACTORY,
  DEFAULT_DAILY_VOLUME_FIELD,
} from "../../helpers/getUniSubgraphVolume";
import { CHAIN } from "../../helpers/chains";
import type {
  BaseAdapter,
  BreakdownAdapter,
  ChainEndpoints,
  FetchResultV2,
} from "../../adapters/types";
import type { Chain } from "@defillama/sdk/build/general";
import { getGraphDimensions } from "../../helpers/getUniSubgraph";
import { GraphQLClient, gql } from "graphql-request";

const v2Endpoints: ChainEndpoints = {
  [CHAIN.MODE]:
    "https://api.goldsky.com/api/public/project_cltceeuudv1ij01x7ekxhfl46/subgraphs/swapmode-v2/prod/gn",
};
const v3Endpoints = {
  [CHAIN.MODE]:
    "https://api.goldsky.com/api/public/project_cltceeuudv1ij01x7ekxhfl46/subgraphs/swapmode-v3/prod/gn",
};

// Fetch function to query the subgraphs
const v2Graph = getGraphDimensions({
  graphUrls: v2Endpoints,
  totalVolume: {
    factory: DEFAULT_TOTAL_VOLUME_FACTORY,
    field: DEFAULT_TOTAL_VOLUME_FIELD,
  },
  dailyVolume: {
    factory: DEFAULT_DAILY_VOLUME_FACTORY,
    field: DEFAULT_DAILY_VOLUME_FIELD,
  },
  feesPercent: {
    type: "volume",
    UserFees: 0.3,
    SupplySideRevenue: 0.06,
    ProtocolRevenue: 0.24,
    Revenue: 0.3,
    Fees: 0.3,
  },
});

const v3Graphs = getGraphDimensions({
  graphUrls: v3Endpoints,
  totalVolume: {
    factory: "factories",
    field: DEFAULT_TOTAL_VOLUME_FIELD,
  },
  dailyVolume: {
    factory: DEFAULT_DAILY_VOLUME_FACTORY,
    field: "volumeUSD",
  },
  feesPercent: {
    type: "fees",
    ProtocolRevenue: 64,
    UserFees: 100,
    SupplySideRevenue: 36,
    Revenue: 0,
  },
});

// const graphQLClient = new GraphQLClient("https://api-backend-0191c757fded.herokuapp.com/graphql");
const graphQLClient = new GraphQLClient("http://localhost:5000/graphql");
const getStakingData = async (chainId: number): Promise<FetchResultV2> => {
try {
  const data: any = await graphQLClient.request(
    gql`
      query GetStakingTVL($chainId: Int!) {
        getStakingTVL(chainId: $chainId) {
          tvlNum
        }
      }
    `,
    {
      chainId,
    }
  );

  return {
    tvl: data.getStakingTVL.tvlNum.toString(),
  };
} catch (error) {
  console.log(error)
  return {
    tvl: "0"
  }
}
};

const v2Methodology = {
  UserFees: "User pays 0.3% fees on each swap.",
  SupplySideRevenue: "LPs receive 0.06% of each swap.",
  ProtocolRevenue: "Treasury receives 0.24% of each swap.",
  Revenue: "All revenue generated comes from user fees.",
  Fees: "All fees come from the user.",
};

const v3Methodology = {
  UserFees:
    "User pays a variable percentage on each swap depending on the pool. Minimum: 0.008%, maximum: 1%.",
  SupplySideRevenue: "LPs receive 36% of the current swap fee",
  ProtocolRevenue: "Treasury receives 64% of each swap",
  Fees: "All fees come from the user.",
};

const adapter: BreakdownAdapter = {
  version: 2,
  breakdown: {
    v2: Object.keys(v2Endpoints).reduce((acc, chain) => {
      return {
        ...acc,
        [chain]: {
          fetch: v2Graph(chain as Chain),
          start: 3325219,
          customBackfill: customBackfill(chain, v2Graph),
          meta: { methodology: v2Methodology },
        },
      };
    }, {} as BaseAdapter),
    v3: Object.keys(v3Endpoints).reduce((acc, chain) => {
      acc[chain] = {
        fetch: v3Graphs(chain as Chain),
        start: 5005167, 
        meta: {
          methodology: v3Methodology,
        },
      };
      return acc;
    }, {} as BaseAdapter),
    staking: {
      [CHAIN.MODE]: {
        fetch: () => {
          return getStakingData(34443);
        },
        start: 3325219,
        meta: {
          methodology:
            "Staking acoounts for SMD and xSMD deposited in staking pools. As well as xSMD allocated to the Yield Booster for LP positions",
        },
      },
    },
  },
};

export default adapter;
