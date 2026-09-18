/**
 * Tessera program tests.
 *
 * These exercise the two properties the design rests on:
 *
 *  1. The vault can never end up backing fewer components than the outstanding
 *     shares claim. Deposits round up, redemptions round down.
 *  2. The ScaledUiAmount multiplier that xStocks use to accrue dividends does not
 *     disturb the recipe, because the recipe is written in raw units. Bumping a
 *     component's multiplier must not change what a share redeems for on chain,
 *     while increasing what that holding is worth to its owner.
 */
import * as anchor from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createInitializeMint2Instruction,
  createInitializeMetadataPointerInstruction,
  createInitializeScaledUiAmountConfigInstruction,
  createUpdateMultiplierDataInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createSetAuthorityInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
  getMint,
  AuthorityType,
  tokenMetadataInitializeWithRentTransfer,
  getScaledUiAmountConfig,
  createInitializeTransferFeeConfigInstruction,
  getTransferFeeAmount,
} from "@solana/spl-token";
import { assert } from "chai";
import type { Tessera } from "../target/types/tessera";

const ONE_SHARE = 1_000_000; // share mint has 6 decimals
const COMPONENT_DECIMALS = 8; // every xStock uses 8

describe("tessera", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.tessera as anchor.Program<Tessera>;
  const payer = (provider.wallet as anchor.Wallet).payer;

  /** Mock xStock: Token-2022, 8 decimals, metadata, and a live multiplier. */
  async function createComponentMint(symbol: string, multiplier = 1.0) {
    const mint = Keypair.generate();
    const extensions = [
      ExtensionType.MetadataPointer,
      ExtensionType.ScaledUiAmountConfig,
    ];
    const space = getMintLen(extensions);
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(
      space + 300, // headroom for the variable-length metadata
    );

    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        space,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(
        mint.publicKey,
        payer.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeScaledUiAmountConfigInstruction(
        mint.publicKey,
        payer.publicKey,
        multiplier,
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMint2Instruction(
        mint.publicKey,
        COMPONENT_DECIMALS,
        payer.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      ),
    );
    await sendAndConfirmTransaction(provider.connection, tx, [payer, mint]);

    await tokenMetadataInitializeWithRentTransfer(
      provider.connection,
      payer,
      mint.publicKey,
      payer.publicKey,
      payer,
      `${symbol} test`,
      symbol,
      `https://tessera.test/${symbol}.json`,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );
    return mint.publicKey;
  }

  /**
   * Share mint: created by the client, handed to the basket.
   *
   * Metadata has to be initialised while an ordinary keypair still holds the mint
   * authority, because the token-metadata instruction needs that authority to
   * sign and a program-derived address cannot sign a client transaction. So we
   * initialise, then hand the authority to the basket.
   */
  async function createShareMint(basket: PublicKey, name: string, symbol: string) {
    const mint = Keypair.generate();
    const space = getMintLen([ExtensionType.MetadataPointer]);
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(
      space + 400,
    );
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        space,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(
        mint.publicKey,
        payer.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMint2Instruction(
        mint.publicKey,
        6,
        payer.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID,
      ),
    );
    await sendAndConfirmTransaction(provider.connection, tx, [payer, mint]);

    await tokenMetadataInitializeWithRentTransfer(
      provider.connection,
      payer,
      mint.publicKey,
      payer.publicKey,
      payer,
      name,
      symbol,
      `https://tessera.test/basket/${symbol}.json`,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );

    await sendAndConfirmTransaction(
      provider.connection,
      new Transaction().add(
        createSetAuthorityInstruction(
          mint.publicKey,
          payer.publicKey,
          AuthorityType.MintTokens,
          basket,
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      ),
      [payer],
    );
    return mint.publicKey;
  }

  async function fundHolder(mint: PublicKey, owner: PublicKey, rawAmount: bigint) {
    const ata = getAssociatedTokenAddressSync(
      mint,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    await sendAndConfirmTransaction(
      provider.connection,
      new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          payer.publicKey,
          ata,
          owner,
          mint,
          TOKEN_2022_PROGRAM_ID,
        ),
        createMintToInstruction(
          mint,
          ata,
          payer.publicKey,
          rawAmount,
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      ),
      [payer],
    );
    return ata;
  }

  const basketPda = (creator: PublicKey, symbol: string) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("basket"), creator.toBuffer(), Buffer.from(symbol)],
      program.programId,
    )[0];

  const vaultFor = (basket: PublicKey, mint: PublicKey) =>
    getAssociatedTokenAddressSync(mint, basket, true, TOKEN_2022_PROGRAM_ID);

  const rawBalance = async (ata: PublicKey) =>
    (await getAccount(provider.connection, ata, undefined, TOKEN_2022_PROGRAM_ID))
      .amount;

  // ---------------------------------------------------------------- fixtures

  let components: PublicKey[];
  let unitsPerShare: anchor.BN[];
  let basket: PublicKey;
  let shareMint: PublicKey;
  const SYMBOL = "MAG3";
  const FEE_BPS = 30;

  before(async () => {
    // Three mock xStocks. The third starts with a multiplier already above 1,
    // the way a real xStock that has accrued a dividend does.
    components = [
      await createComponentMint("AAPLx"),
      await createComponentMint("NVDAx"),
      await createComponentMint("MSFTx", 1.0026642),
    ];
    // Raw units per whole share, as the front end would compute them from live
    // prices for a 50/30/20 basket.
    unitsPerShare = [new anchor.BN(15_000_000), new anchor.BN(9_000_000), new anchor.BN(4_000_000)];

    basket = basketPda(payer.publicKey, SYMBOL);
    shareMint = await createShareMint(basket, "Magnificent Three", SYMBOL);

    await program.methods
      .createBasket(
        "Magnificent Three",
        SYMBOL,
        FEE_BPS,
        components.map((mint, i) => ({
          mint,
          unitsPerShare: unitsPerShare[i],
          weightBps: [5000, 3000, 2000][i],
        })),
      )
      .accountsPartial({
        creator: payer.publicKey,
        basket,
        shareMint,
        componentTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(
        components.map((mint) => ({
          pubkey: mint,
          isSigner: false,
          isWritable: false,
        })),
      )
      .rpc();
  });

  it("records the recipe it was given", async () => {
    const account = await program.account.basket.fetch(basket);
    assert.equal(account.name, "Magnificent Three");
    assert.equal(account.symbol, SYMBOL);
    assert.equal(account.componentCount, 3);
    assert.equal(account.creatorFeeBps, FEE_BPS);
    assert.equal(account.shareMint.toBase58(), shareMint.toBase58());
    for (let i = 0; i < 3; i++) {
      assert.equal(account.components[i].mint.toBase58(), components[i].toBase58());
      assert.isTrue(account.components[i].unitsPerShare.eq(unitsPerShare[i]));
      assert.equal(account.components[i].decimals, COMPONENT_DECIMALS);
    }
  });

  it("refuses a recipe whose weights do not add up", async () => {
    const symbol = "BADW";
    const pda = basketPda(payer.publicKey, symbol);
    const mint = await createShareMint(pda, "Bad Weights", symbol);
    try {
      await program.methods
        .createBasket("Bad Weights", symbol, 0, [
          { mint: components[0], unitsPerShare: new anchor.BN(1000), weightBps: 6000 },
          { mint: components[1], unitsPerShare: new anchor.BN(1000), weightBps: 3000 },
        ])
        .accountsPartial({
          creator: payer.publicKey,
          basket: pda,
          shareMint: mint,
          componentTokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(
          components.slice(0, 2).map((m) => ({
            pubkey: m,
            isSigner: false,
            isWritable: false,
          })),
        )
        .rpc();
      assert.fail("expected the weight check to reject this");
    } catch (err: any) {
      assert.include(err.toString(), "WeightsMustSumToOne");
    }
  });

  it("refuses a creator fee above 1%", async () => {
    const symbol = "GREED";
    const pda = basketPda(payer.publicKey, symbol);
    const mint = await createShareMint(pda, "Too Greedy", symbol);
    try {
      await program.methods
        .createBasket("Too Greedy", symbol, 500, [
          { mint: components[0], unitsPerShare: new anchor.BN(1000), weightBps: 10000 },
        ])
        .accountsPartial({
          creator: payer.publicKey,
          basket: pda,
          shareMint: mint,
          componentTokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: components[0], isSigner: false, isWritable: false },
        ])
        .rpc();
      assert.fail("expected the fee cap to reject this");
    } catch (err: any) {
      assert.include(err.toString(), "CreatorFeeTooHigh");
    }
  });

  // ------------------------------------------------------------ mint & redeem

  const holder = Keypair.generate();
  let holderComponentAtas: PublicKey[];
  let holderShareAta: PublicKey;
  let creatorShareAta: PublicKey;

  async function prepareHolder() {
    const sig = await provider.connection.requestAirdrop(
      holder.publicKey,
      2_000_000_000,
    );
    await provider.connection.confirmTransaction(sig);

    holderComponentAtas = [];
    for (const mint of components) {
      // Plenty of every component: 100 whole tokens each.
      holderComponentAtas.push(
        await fundHolder(mint, holder.publicKey, 100n * 10n ** 8n),
      );
    }

    holderShareAta = getAssociatedTokenAddressSync(
      shareMint,
      holder.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    creatorShareAta = getAssociatedTokenAddressSync(
      shareMint,
      payer.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID,
    );

    const setup = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        holderShareAta,
        holder.publicKey,
        shareMint,
        TOKEN_2022_PROGRAM_ID,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        creatorShareAta,
        payer.publicKey,
        shareMint,
        TOKEN_2022_PROGRAM_ID,
      ),
    );
    for (const mint of components) {
      setup.add(
        createAssociatedTokenAccountIdempotentInstruction(
          payer.publicKey,
          vaultFor(basket, mint),
          basket,
          mint,
          TOKEN_2022_PROGRAM_ID,
        ),
      );
    }
    await sendAndConfirmTransaction(provider.connection, setup, [payer]);
  }

  function mintRemaining() {
    return components.flatMap((mint, i) => [
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: holderComponentAtas[i], isSigner: false, isWritable: true },
      { pubkey: vaultFor(basket, mint), isSigner: false, isWritable: true },
    ]);
  }

  function redeemRemaining() {
    return components.flatMap((mint, i) => [
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: vaultFor(basket, mint), isSigner: false, isWritable: true },
      { pubkey: holderComponentAtas[i], isSigner: false, isWritable: true },
    ]);
  }

  it("takes the recipe in and issues shares, net of the creator fee", async () => {
    await prepareHolder();

    const shares = new anchor.BN(2.5 * ONE_SHARE);
    await program.methods
      .mintShares(shares)
      .accountsPartial({
        basket,
        shareMint,
        depositor: holder.publicKey,
        depositorShareAccount: holderShareAta,
        creatorShareAccount: creatorShareAta,
        shareTokenProgram: TOKEN_2022_PROGRAM_ID,
        componentTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .remainingAccounts(mintRemaining())
      .signers([holder])
      .rpc();

    // Each vault holds exactly units_per_share x 2.5.
    for (let i = 0; i < components.length; i++) {
      const expected =
        (BigInt(unitsPerShare[i].toString()) * BigInt(shares.toString())) /
        BigInt(ONE_SHARE);
      assert.equal(
        (await rawBalance(vaultFor(basket, components[i]))).toString(),
        expected.toString(),
        `vault ${i}`,
      );
    }

    const fee = (BigInt(shares.toString()) * BigInt(FEE_BPS)) / 10_000n;
    assert.equal(
      (await rawBalance(holderShareAta)).toString(),
      (BigInt(shares.toString()) - fee).toString(),
      "holder shares are net of the fee",
    );
    assert.equal(
      (await rawBalance(creatorShareAta)).toString(),
      fee.toString(),
      "creator receives the fee in shares",
    );
  });

  it("keeps the vault fully backing every outstanding share", async () => {
    const mintInfo = await getMint(
      provider.connection,
      shareMint,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );
    for (let i = 0; i < components.length; i++) {
      const held = await rawBalance(vaultFor(basket, components[i]));
      const owed =
        (BigInt(unitsPerShare[i].toString()) * mintInfo.supply) /
        BigInt(ONE_SHARE);
      assert.isTrue(
        held >= owed,
        `component ${i}: vault holds ${held}, shares claim ${owed}`,
      );
    }
  });

  it("hands the components back on redemption", async () => {
    const before = await Promise.all(
      holderComponentAtas.map((ata) => rawBalance(ata)),
    );
    const shares = new anchor.BN(1 * ONE_SHARE);

    await program.methods
      .redeemShares(shares)
      .accountsPartial({
        basket,
        shareMint,
        owner: holder.publicKey,
        ownerShareAccount: holderShareAta,
        shareTokenProgram: TOKEN_2022_PROGRAM_ID,
        componentTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .remainingAccounts(redeemRemaining())
      .signers([holder])
      .rpc();

    for (let i = 0; i < components.length; i++) {
      const after = await rawBalance(holderComponentAtas[i]);
      const expected =
        (BigInt(unitsPerShare[i].toString()) * BigInt(shares.toString())) /
        BigInt(ONE_SHARE);
      assert.equal(
        (after - before[i]).toString(),
        expected.toString(),
        `component ${i} returned`,
      );
    }
  });

  it("rejects a vault that is not the basket's own token account", async () => {
    const impostor = await fundHolder(components[0], holder.publicKey, 0n);
    const remaining = components.flatMap((mint, i) => [
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: holderComponentAtas[i], isSigner: false, isWritable: true },
      {
        pubkey: i === 0 ? impostor : vaultFor(basket, mint),
        isSigner: false,
        isWritable: true,
      },
    ]);
    try {
      await program.methods
        .mintShares(new anchor.BN(ONE_SHARE))
        .accountsPartial({
          basket,
          shareMint,
          depositor: holder.publicKey,
          depositorShareAccount: holderShareAta,
          creatorShareAccount: creatorShareAta,
          shareTokenProgram: TOKEN_2022_PROGRAM_ID,
          componentTokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .remainingAccounts(remaining)
        .signers([holder])
        .rpc();
      assert.fail("expected the vault check to reject this");
    } catch (err: any) {
      assert.include(err.toString(), "VaultMismatch");
    }
  });

  it("is unmoved by a dividend accruing into a component's multiplier", async () => {
    // MSFTx accrues a dividend: its multiplier steps up. On chain the recipe is
    // written in raw units, so redemption must return exactly the same raw
    // amount as before — while being worth more to whoever receives it.
    const target = components[2];
    const beforeMint = await getMint(
      provider.connection,
      target,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );
    const beforeMultiplier = Number(
      getScaledUiAmountConfig(beforeMint)?.multiplier ?? 1,
    );

    await sendAndConfirmTransaction(
      provider.connection,
      new Transaction().add(
        createUpdateMultiplierDataInstruction(
          target,
          payer.publicKey,
          1.05,
          0n, // effective immediately
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      ),
      [payer],
    );

    const beforeRaw = await rawBalance(holderComponentAtas[2]);
    const shares = new anchor.BN(0.5 * ONE_SHARE);

    await program.methods
      .redeemShares(shares)
      .accountsPartial({
        basket,
        shareMint,
        owner: holder.publicKey,
        ownerShareAccount: holderShareAta,
        shareTokenProgram: TOKEN_2022_PROGRAM_ID,
        componentTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .remainingAccounts(redeemRemaining())
      .signers([holder])
      .rpc();

    const afterRaw = await rawBalance(holderComponentAtas[2]);
    const expectedRaw =
      (BigInt(unitsPerShare[2].toString()) * BigInt(shares.toString())) /
      BigInt(ONE_SHARE);

    assert.equal(
      (afterRaw - beforeRaw).toString(),
      expectedRaw.toString(),
      "raw redemption is untouched by the multiplier",
    );
    assert.isAbove(1.05, beforeMultiplier, "the multiplier really did rise");
  });

  // PreStocks tokens carry a TransferFeeConfig extension xStocks do not: every
  // transfer skims a fee at the token-program level. A deposit has to gross up
  // for that fee, or the vault ends up backing shares by less than the recipe.
  async function createFeeComponentMint(feeBps: number) {
    const mint = Keypair.generate();
    const space = getMintLen([ExtensionType.TransferFeeConfig]);
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(space);
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        space,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferFeeConfigInstruction(
        mint.publicKey,
        payer.publicKey,
        payer.publicKey,
        feeBps,
        BigInt("18446744073709551615"), // uncapped, same as a live PreStocks mint
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMint2Instruction(mint.publicKey, 9, payer.publicKey, null, TOKEN_2022_PROGRAM_ID),
    );
    await sendAndConfirmTransaction(provider.connection, tx, [payer, mint]);
    return mint.publicKey;
  }

  it("grosses up a deposit so a transfer-fee component still nets the recipe amount", async () => {
    const FEE_BPS = 50; // matches the live PreStocks fee
    const feeMint = await createFeeComponentMint(FEE_BPS);
    const unitsPerShareFee = new anchor.BN(1_000_000_000); // 1 whole token, 9 decimals

    const symbol = "FEE1";
    const pda = basketPda(payer.publicKey, symbol);
    const mint = await createShareMint(pda, "Fee Component Basket", symbol);
    await program.methods
      .createBasket("Fee Component Basket", symbol, 0, [
        { mint: feeMint, unitsPerShare: unitsPerShareFee, weightBps: 10000 },
      ])
      .accountsPartial({
        creator: payer.publicKey,
        basket: pda,
        shareMint: mint,
        componentTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts([{ pubkey: feeMint, isSigner: false, isWritable: false }])
      .rpc();

    const feeHolder = Keypair.generate();
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(feeHolder.publicKey, 2_000_000_000),
    );
    const holderAta = await fundHolder(feeMint, feeHolder.publicKey, 10n * 10n ** 9n);
    const holderShareAta = getAssociatedTokenAddressSync(mint, feeHolder.publicKey, true, TOKEN_2022_PROGRAM_ID);
    const vault = vaultFor(pda, feeMint);
    await sendAndConfirmTransaction(
      provider.connection,
      new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          payer.publicKey,
          holderShareAta,
          feeHolder.publicKey,
          mint,
          TOKEN_2022_PROGRAM_ID,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          payer.publicKey,
          vault,
          pda,
          feeMint,
          TOKEN_2022_PROGRAM_ID,
        ),
      ),
      [payer],
    );

    const before = await rawBalance(holderAta);
    await program.methods
      .mintShares(new anchor.BN(ONE_SHARE))
      .accountsPartial({
        basket: pda,
        shareMint: mint,
        depositor: feeHolder.publicKey,
        depositorShareAccount: holderShareAta,
        // No creator fee on this basket, so the program never touches this
        // account — but Anchor's client-side validation still wants one named.
        creatorShareAccount: holderShareAta,
        shareTokenProgram: TOKEN_2022_PROGRAM_ID,
        componentTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: feeMint, isSigner: false, isWritable: false },
        { pubkey: holderAta, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
      ])
      .signers([feeHolder])
      .rpc();

    const vaultBalance = await rawBalance(vault);
    assert.equal(
      vaultBalance.toString(),
      unitsPerShareFee.toString(),
      "the vault nets exactly the recipe amount despite the transfer fee",
    );

    const vaultAccount = await getAccount(provider.connection, vault, undefined, TOKEN_2022_PROGRAM_ID);
    const withheld = getTransferFeeAmount(vaultAccount)?.withheldAmount ?? 0n;
    const after = await rawBalance(holderAta);
    assert.equal(
      (before - after).toString(),
      (vaultBalance + withheld).toString(),
      "the holder paid the recipe amount plus exactly the fee the token program withheld",
    );
  });

  it("still fully backs every share after all that", async () => {
    const mintInfo = await getMint(
      provider.connection,
      shareMint,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );
    for (let i = 0; i < components.length; i++) {
      const held = await rawBalance(vaultFor(basket, components[i]));
      const owed =
        (BigInt(unitsPerShare[i].toString()) * mintInfo.supply) /
        BigInt(ONE_SHARE);
      assert.isTrue(held >= owed, `component ${i} still covered`);
    }
  });
});
