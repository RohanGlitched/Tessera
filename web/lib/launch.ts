import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  LAUNCH_SUPPLY,
  NATIVE_SOL,
  TREASURY,
  launchKeys,
  launchName,
  launchSymbol,
} from "./dbc";
import { SITE_URL } from "./config";

/** The curve opens at half the basket's NAV and graduates at twenty times it. */
export const OPEN_MULTIPLE = 0.5;
export const GRADUATION_MULTIPLE = 20;
/** Share of curve trading fees that goes to the basket's creator; the rest to Tessera. */
export const CREATOR_FEE_SHARE = 50;

export async function solUsd(): Promise<number> {
  const body = await fetch(`https://lite-api.jup.ag/price/v3?ids=${NATIVE_SOL.toBase58()}`, {
    signal: AbortSignal.timeout(10_000),
  }).then((r) => r.json());
  const price = body?.[NATIVE_SOL.toBase58()]?.usdPrice;
  if (!price) throw new Error("Could not read a live SOL price.");
  return price;
}

/**
 * The one transaction that opens a basket's launch: a DBC config sized off the
 * basket's NAV and the pool on it. Partially signed by the derived config and
 * mint keys; the creator's wallet pays and signs last.
 */
export async function buildLaunch(params: {
  connection: Connection;
  creator: PublicKey;
  basket: { address: string; name: string; symbol: string };
  navSol: number;
}): Promise<Transaction> {
  const { connection, creator, basket, navSol } = params;
  const {
    DynamicBondingCurveClient,
    buildCurveWithMarketCap,
    TokenType,
    TokenDecimal,
    TokenAuthorityOption,
    ActivationType,
    CollectFeeMode,
    BaseFeeMode,
    MigrationOption,
    MigrationFeeOption,
    MigratedCollectFeeMode,
  } = await import("@meteora-ag/dynamic-bonding-curve-sdk");

  const curve = buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.Token2022,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.NINE,
      // No upgrade path for the token, the same reason a share mint has no freeze authority.
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: LAUNCH_SUPPLY,
      leftover: LAUNCH_SUPPLY * 0.01,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerExponential,
        // Anti-snipe: 4% at the open, decaying to 1% within the hour.
        feeSchedulerParam: {
          startingFeeBps: 400,
          endingFeeBps: 100,
          numberOfPeriod: 60,
          totalDuration: 3600,
        },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: CREATOR_FEE_SHARE,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.Customizable,
      migrationFee: { feePercentage: 1, creatorFeePercentage: 0 },
      migratedPoolFee: {
        collectFeeMode: MigratedCollectFeeMode.QuoteToken,
        dynamicFee: 0,
        poolFeeBps: 100,
      },
    },
    // Every migrated LP position is locked for good: nobody can pull the
    // graduated pool's liquidity, the same way nobody can drain a basket vault.
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 50,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 50,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Slot,
    initialMarketCap: navSol * OPEN_MULTIPLE,
    migrationMarketCap: navSol * GRADUATION_MULTIPLE,
  });

  const { config, mint } = await launchKeys(basket.address);
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const transaction = await client.partner.createConfigAndPool({
    ...curve,
    payer: creator,
    config: config.publicKey,
    feeClaimer: TREASURY,
    leftoverReceiver: TREASURY,
    quoteMint: NATIVE_SOL,
    preCreatePoolParam: {
      name: launchName(basket.name),
      symbol: launchSymbol(basket.symbol),
      uri: `${SITE_URL}/api/launch/${basket.address}`,
      poolCreator: creator,
      baseMint: mint.publicKey,
    },
  });
  transaction.feePayer = creator;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.partialSign(config, mint);
  return transaction;
}

