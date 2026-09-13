//! Tessera — permissionless, in-kind index baskets for tokenized equities.
//!
//! A basket is a fixed recipe: for one whole share, hand the vault
//! `units_per_share` raw units of each component and receive one share token.
//! Burn a share token and the vault hands the components back, pro rata.
//!
//! Everything is settled in kind. The program never reads a price feed, so a
//! stale or manipulated oracle cannot mis-price a mint or a redemption, and the
//! vault cannot become under-collateralised: minting rounds deposits up and
//! redeeming rounds withdrawals down, so rounding dust always favours the vault.
//!
//! Components are Token-2022 mints (every xStock is). The `ScaledUiAmount`
//! extension that xStocks use to accrue dividends multiplies the *displayed*
//! balance, never the raw balance, so a raw-unit recipe is unaffected by it and
//! dividend accrual flows through to holders automatically.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Burn, MintTo, TokenInterface, TransferChecked};

declare_id!("F8QLTZPe9mJuPgXCbccnU9G2kMSEE4inygdUw3QZbrQ");

/// Share tokens always have 6 decimals.
pub const SHARE_DECIMALS: u8 = 6;
/// One whole share, in raw share units.
pub const ONE_SHARE: u64 = 1_000_000;
/// Upper bound on basket size, so `mint`/`redeem` fit in one transaction.
pub const MAX_COMPONENTS: usize = 8;
/// Creator fees are capped at 1%.
pub const MAX_CREATOR_FEE_BPS: u16 = 100;
pub const MAX_NAME_LEN: usize = 32;
pub const MAX_SYMBOL_LEN: usize = 10;

#[program]
pub mod tessera {
    use super::*;

    /// Publish a basket recipe and take ownership of its share mint.
    ///
    /// The share mint is created by the client (a Token-2022 mint carrying
    /// on-chain metadata) with its mint authority already set to this basket's
    /// PDA. We verify that here rather than trusting it.
    pub fn create_basket(
        ctx: Context<CreateBasket>,
        name: String,
        symbol: String,
        creator_fee_bps: u16,
        components: Vec<ComponentArg>,
    ) -> Result<()> {
        require!(!name.is_empty() && name.len() <= MAX_NAME_LEN, TesseraError::NameTooLong);
        require!(
            !symbol.is_empty() && symbol.len() <= MAX_SYMBOL_LEN,
            TesseraError::SymbolTooLong
        );
        require!(
            creator_fee_bps <= MAX_CREATOR_FEE_BPS,
            TesseraError::CreatorFeeTooHigh
        );
        require!(
            !components.is_empty() && components.len() <= MAX_COMPONENTS,
            TesseraError::BadComponentCount
        );

        let basket_key = ctx.accounts.basket.key();
        let token_program_key = ctx.accounts.component_token_program.key();

        // The share mint must be a blank, basket-controlled, 6-decimal mint.
        let share_mint_info = ctx.accounts.share_mint.to_account_info();
        let mint_state = MintFields::parse(&share_mint_info.try_borrow_data()?)?;
        require!(
            mint_state.decimals == SHARE_DECIMALS,
            TesseraError::ShareMintDecimals
        );
        require!(mint_state.supply == 0, TesseraError::ShareMintNotEmpty);
        require!(
            mint_state.mint_authority == Some(basket_key),
            TesseraError::ShareMintAuthority
        );
        require!(
            mint_state.freeze_authority.is_none(),
            TesseraError::ShareMintFreezable
        );

        // Components must be distinct, correctly weighted, and live on the
        // token program the caller declared.
        let mut total_weight: u32 = 0;
        let mut stored: [Component; MAX_COMPONENTS] = Default::default();

        require!(
            ctx.remaining_accounts.len() == components.len(),
            TesseraError::AccountCountMismatch
        );

        for (i, arg) in components.iter().enumerate() {
            require!(arg.units_per_share > 0, TesseraError::ZeroUnits);
            require!(arg.weight_bps > 0, TesseraError::ZeroWeight);
            for prior in components.iter().take(i) {
                require!(prior.mint != arg.mint, TesseraError::DuplicateComponent);
            }
            total_weight = total_weight
                .checked_add(arg.weight_bps as u32)
                .ok_or(TesseraError::MathOverflow)?;

            let mint_info = &ctx.remaining_accounts[i];
            require!(mint_info.key() == arg.mint, TesseraError::ComponentMintMismatch);
            require!(
                mint_info.owner == &token_program_key,
                TesseraError::WrongTokenProgram
            );
            let decimals = MintFields::parse(&mint_info.try_borrow_data()?)?.decimals;

            stored[i] = Component {
                mint: arg.mint,
                units_per_share: arg.units_per_share,
                weight_bps: arg.weight_bps,
                decimals,
                _padding: [0; 5],
            };
        }
        require!(total_weight == 10_000, TesseraError::WeightsMustSumToOne);

        let basket = &mut ctx.accounts.basket;
        basket.creator = ctx.accounts.creator.key();
        basket.share_mint = ctx.accounts.share_mint.key();
        basket.token_program = token_program_key;
        basket.name = name.clone();
        basket.symbol = symbol.clone();
        basket.creator_fee_bps = creator_fee_bps;
        basket.component_count = components.len() as u8;
        basket.components = stored;
        basket.created_at = Clock::get()?.unix_timestamp;
        basket.mint_count = 0;
        basket.redeem_count = 0;
        basket.bump = ctx.bumps.basket;

        emit!(BasketCreated {
            basket: basket_key,
            creator: basket.creator,
            share_mint: basket.share_mint,
            name,
            symbol,
            component_count: basket.component_count,
        });
        Ok(())
    }

    /// Deposit the recipe in kind and receive `shares` share tokens.
    ///
    /// `remaining_accounts` is three per component, in basket order:
    /// `[component_mint, depositor_token_account, basket_vault_ata]`.
    pub fn mint_shares<'info>(
        ctx: Context<'_, '_, 'info, 'info, MintShares<'info>>,
        shares: u64,
    ) -> Result<()> {
        require!(shares > 0, TesseraError::ZeroShares);
        let basket = &ctx.accounts.basket;
        let count = basket.component_count as usize;
        require!(
            ctx.remaining_accounts.len() == count * 3,
            TesseraError::AccountCountMismatch
        );

        let basket_key = basket.key();
        let token_program_key = basket.token_program;
        require!(
            ctx.accounts.component_token_program.key() == token_program_key,
            TesseraError::WrongTokenProgram
        );

        let mut deposited = [0u64; MAX_COMPONENTS];

        for i in 0..count {
            let component = basket.components[i];
            let mint_info = &ctx.remaining_accounts[i * 3];
            let from_info = &ctx.remaining_accounts[i * 3 + 1];
            let vault_info = &ctx.remaining_accounts[i * 3 + 2];

            require!(
                mint_info.key() == component.mint,
                TesseraError::ComponentMintMismatch
            );
            // Deposits round up, so rounding dust accrues to the vault.
            let amount = mul_div_ceil(component.units_per_share, shares, ONE_SHARE)?;
            require!(amount > 0, TesseraError::DustMint);

            verify_vault(vault_info, &basket_key, &component.mint, &token_program_key)?;
            verify_token_account(from_info, &component.mint)?;

            token_interface::transfer_checked(
                CpiContext::new(
                    ctx.accounts.component_token_program.to_account_info(),
                    TransferChecked {
                        from: from_info.clone(),
                        mint: mint_info.clone(),
                        to: vault_info.clone(),
                        authority: ctx.accounts.depositor.to_account_info(),
                    },
                ),
                amount,
                component.decimals,
            )?;
            deposited[i] = amount;
        }

        // The creator's cut comes out of the shares issued, never out of the
        // vault, so backing per share is identical before and after.
        let fee_shares = mul_div_floor(shares, basket.creator_fee_bps as u64, 10_000)?;
        let net_shares = shares.checked_sub(fee_shares).ok_or(TesseraError::MathOverflow)?;
        require!(net_shares > 0, TesseraError::ZeroShares);

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"basket",
            basket.creator.as_ref(),
            basket.symbol.as_bytes(),
            &[basket.bump],
        ]];

        token_interface::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.share_token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.share_mint.to_account_info(),
                    to: ctx.accounts.depositor_share_account.to_account_info(),
                    authority: ctx.accounts.basket.to_account_info(),
                },
                signer_seeds,
            ),
            net_shares,
        )?;

        if fee_shares > 0 {
            let creator_share_account = ctx
                .accounts
                .creator_share_account
                .as_ref()
                .ok_or(TesseraError::MissingCreatorShareAccount)?;
            verify_token_account(
                &creator_share_account.to_account_info(),
                &ctx.accounts.share_mint.key(),
            )?;
            token_interface::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.share_token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.share_mint.to_account_info(),
                        to: creator_share_account.to_account_info(),
                        authority: ctx.accounts.basket.to_account_info(),
                    },
                    signer_seeds,
                ),
                fee_shares,
            )?;
        }

        let basket = &mut ctx.accounts.basket;
        basket.mint_count = basket.mint_count.saturating_add(1);

        emit!(SharesMinted {
            basket: basket_key,
            depositor: ctx.accounts.depositor.key(),
            shares_issued: net_shares,
            creator_fee_shares: fee_shares,
            amounts: deposited,
        });
        Ok(())
    }

    /// Burn `shares` and take the underlying components back out, pro rata.
    ///
    /// `remaining_accounts` is three per component, in basket order:
    /// `[component_mint, basket_vault_ata, recipient_token_account]`.
    pub fn redeem_shares<'info>(
        ctx: Context<'_, '_, 'info, 'info, RedeemShares<'info>>,
        shares: u64,
    ) -> Result<()> {
        require!(shares > 0, TesseraError::ZeroShares);
        let basket = &ctx.accounts.basket;
        let count = basket.component_count as usize;
        require!(
            ctx.remaining_accounts.len() == count * 3,
            TesseraError::AccountCountMismatch
        );
        require!(
            ctx.accounts.component_token_program.key() == basket.token_program,
            TesseraError::WrongTokenProgram
        );

        let basket_key = basket.key();
        let token_program_key = basket.token_program;

        // Burn first: no component leaves the vault until the shares are gone.
        token_interface::burn(
            CpiContext::new(
                ctx.accounts.share_token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.share_mint.to_account_info(),
                    from: ctx.accounts.owner_share_account.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            shares,
        )?;

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"basket",
            basket.creator.as_ref(),
            basket.symbol.as_bytes(),
            &[basket.bump],
        ]];

        let mut withdrawn = [0u64; MAX_COMPONENTS];

        for i in 0..count {
            let component = basket.components[i];
            let mint_info = &ctx.remaining_accounts[i * 3];
            let vault_info = &ctx.remaining_accounts[i * 3 + 1];
            let to_info = &ctx.remaining_accounts[i * 3 + 2];

            require!(
                mint_info.key() == component.mint,
                TesseraError::ComponentMintMismatch
            );
            verify_vault(vault_info, &basket_key, &component.mint, &token_program_key)?;
            verify_token_account(to_info, &component.mint)?;

            // Withdrawals round down, so rounding dust stays in the vault.
            let amount = mul_div_floor(component.units_per_share, shares, ONE_SHARE)?;
            if amount == 0 {
                continue;
            }

            token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.component_token_program.to_account_info(),
                    TransferChecked {
                        from: vault_info.clone(),
                        mint: mint_info.clone(),
                        to: to_info.clone(),
                        authority: ctx.accounts.basket.to_account_info(),
                    },
                    signer_seeds,
                ),
                amount,
                component.decimals,
            )?;
            withdrawn[i] = amount;
        }

        let basket = &mut ctx.accounts.basket;
        basket.redeem_count = basket.redeem_count.saturating_add(1);

        emit!(SharesRedeemed {
            basket: basket_key,
            owner: ctx.accounts.owner.key(),
            shares_burned: shares,
            amounts: withdrawn,
        });
        Ok(())
    }
}

// ---------------------------------------------------------------- accounts

#[derive(Accounts)]
#[instruction(name: String, symbol: String)]
pub struct CreateBasket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = Basket::SPACE,
        seeds = [b"basket", creator.key().as_ref(), symbol.as_bytes()],
        bump,
    )]
    pub basket: Account<'info, Basket>,

    /// CHECK: validated field by field in the handler.
    pub share_mint: UncheckedAccount<'info>,

    pub component_token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintShares<'info> {
    #[account(mut)]
    pub basket: Account<'info, Basket>,

    #[account(mut, address = basket.share_mint @ TesseraError::ShareMintMismatch)]
    /// CHECK: pinned to the basket's recorded share mint.
    pub share_mint: UncheckedAccount<'info>,

    pub depositor: Signer<'info>,

    #[account(mut)]
    /// CHECK: ownership and mint verified in the handler.
    pub depositor_share_account: UncheckedAccount<'info>,

    #[account(mut)]
    /// CHECK: only required when a creator fee is charged; verified in handler.
    pub creator_share_account: Option<UncheckedAccount<'info>>,

    pub share_token_program: Interface<'info, TokenInterface>,
    pub component_token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct RedeemShares<'info> {
    #[account(mut)]
    pub basket: Account<'info, Basket>,

    #[account(mut, address = basket.share_mint @ TesseraError::ShareMintMismatch)]
    /// CHECK: pinned to the basket's recorded share mint.
    pub share_mint: UncheckedAccount<'info>,

    pub owner: Signer<'info>,

    #[account(mut)]
    /// CHECK: burn authority is the owner; the token program enforces the rest.
    pub owner_share_account: UncheckedAccount<'info>,

    pub share_token_program: Interface<'info, TokenInterface>,
    pub component_token_program: Interface<'info, TokenInterface>,
}

// ------------------------------------------------------------------- state

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, PartialEq, Eq, Debug)]
pub struct Component {
    pub mint: Pubkey,
    /// Raw token units of this component backing one whole share.
    pub units_per_share: u64,
    /// Target weight at creation, recorded so drift is measurable later.
    pub weight_bps: u16,
    pub decimals: u8,
    pub _padding: [u8; 5],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ComponentArg {
    pub mint: Pubkey,
    pub units_per_share: u64,
    pub weight_bps: u16,
}

#[account]
pub struct Basket {
    pub creator: Pubkey,
    pub share_mint: Pubkey,
    pub token_program: Pubkey,
    pub name: String,
    pub symbol: String,
    pub creator_fee_bps: u16,
    pub component_count: u8,
    pub components: [Component; MAX_COMPONENTS],
    pub created_at: i64,
    pub mint_count: u64,
    pub redeem_count: u64,
    pub bump: u8,
}

impl Basket {
    pub const SPACE: usize = 8      // discriminator
        + 32 + 32 + 32              // creator, share_mint, token_program
        + 4 + MAX_NAME_LEN          // name
        + 4 + MAX_SYMBOL_LEN        // symbol
        + 2 + 1                     // creator_fee_bps, component_count
        + MAX_COMPONENTS * 48       // components
        + 8 + 8 + 8                 // created_at, mint_count, redeem_count
        + 1                         // bump
        + 64; // headroom
}

// ------------------------------------------------------------------ events

#[event]
pub struct BasketCreated {
    pub basket: Pubkey,
    pub creator: Pubkey,
    pub share_mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub component_count: u8,
}

#[event]
pub struct SharesMinted {
    pub basket: Pubkey,
    pub depositor: Pubkey,
    pub shares_issued: u64,
    pub creator_fee_shares: u64,
    pub amounts: [u64; MAX_COMPONENTS],
}

#[event]
pub struct SharesRedeemed {
    pub basket: Pubkey,
    pub owner: Pubkey,
    pub shares_burned: u64,
    pub amounts: [u64; MAX_COMPONENTS],
}

// ------------------------------------------------------------------ helpers

/// The handful of base-layout mint fields we care about. The layout is byte
/// identical for SPL Token and Token-2022; Token-2022 simply appends
/// extensions after it, which we deliberately ignore here.
struct MintFields {
    mint_authority: Option<Pubkey>,
    supply: u64,
    decimals: u8,
    freeze_authority: Option<Pubkey>,
}

impl MintFields {
    fn parse(data: &[u8]) -> Result<Self> {
        require!(data.len() >= 82, TesseraError::MalformedMint);
        let read_key = |o: usize| -> Pubkey {
            let mut k = [0u8; 32];
            k.copy_from_slice(&data[o..o + 32]);
            Pubkey::new_from_array(k)
        };
        let mint_authority = if u32::from_le_bytes(data[0..4].try_into().unwrap()) == 1 {
            Some(read_key(4))
        } else {
            None
        };
        let supply = u64::from_le_bytes(data[36..44].try_into().unwrap());
        let decimals = data[44];
        let freeze_authority = if u32::from_le_bytes(data[46..50].try_into().unwrap()) == 1 {
            Some(read_key(50))
        } else {
            None
        };
        Ok(Self {
            mint_authority,
            supply,
            decimals,
            freeze_authority,
        })
    }
}

/// A vault must be the canonical associated token account of the basket PDA for
/// that component, so off-chain net-asset-value maths can rely on one address.
fn verify_vault(
    vault: &AccountInfo,
    basket: &Pubkey,
    mint: &Pubkey,
    token_program: &Pubkey,
) -> Result<()> {
    let (expected, _) = Pubkey::find_program_address(
        &[basket.as_ref(), token_program.as_ref(), mint.as_ref()],
        &anchor_spl::associated_token::ID,
    );
    require!(vault.key() == expected, TesseraError::VaultMismatch);
    Ok(())
}

/// Confirm a token account really is for `mint` before moving value through it.
fn verify_token_account(account: &AccountInfo, mint: &Pubkey) -> Result<()> {
    let data = account.try_borrow_data()?;
    require!(data.len() >= 72, TesseraError::MalformedTokenAccount);
    let mut k = [0u8; 32];
    k.copy_from_slice(&data[0..32]);
    require!(
        Pubkey::new_from_array(k) == *mint,
        TesseraError::TokenAccountMintMismatch
    );
    Ok(())
}

fn mul_div_floor(a: u64, b: u64, d: u64) -> Result<u64> {
    let n = (a as u128)
        .checked_mul(b as u128)
        .ok_or(TesseraError::MathOverflow)?;
    let q = n
        .checked_div(d as u128)
        .ok_or(TesseraError::MathOverflow)?;
    u64::try_from(q).map_err(|_| TesseraError::MathOverflow.into())
}

fn mul_div_ceil(a: u64, b: u64, d: u64) -> Result<u64> {
    let n = (a as u128)
        .checked_mul(b as u128)
        .ok_or(TesseraError::MathOverflow)?;
    let q = n
        .checked_add((d as u128).checked_sub(1).ok_or(TesseraError::MathOverflow)?)
        .ok_or(TesseraError::MathOverflow)?
        .checked_div(d as u128)
        .ok_or(TesseraError::MathOverflow)?;
    u64::try_from(q).map_err(|_| TesseraError::MathOverflow.into())
}

#[error_code]
pub enum TesseraError {
    #[msg("Basket name must be 1 to 32 characters")]
    NameTooLong,
    #[msg("Basket symbol must be 1 to 10 characters")]
    SymbolTooLong,
    #[msg("Creator fee cannot exceed 1%")]
    CreatorFeeTooHigh,
    #[msg("A basket holds between 1 and 8 components")]
    BadComponentCount,
    #[msg("Component weights must add up to 100%")]
    WeightsMustSumToOne,
    #[msg("The same component was listed twice")]
    DuplicateComponent,
    #[msg("Every component needs a non-zero weight")]
    ZeroWeight,
    #[msg("Every component needs a non-zero unit amount")]
    ZeroUnits,
    #[msg("Share mint must have 6 decimals")]
    ShareMintDecimals,
    #[msg("Share mint already has a supply")]
    ShareMintNotEmpty,
    #[msg("Share mint authority must be the basket")]
    ShareMintAuthority,
    #[msg("Share mint must not have a freeze authority")]
    ShareMintFreezable,
    #[msg("Share mint does not match the basket")]
    ShareMintMismatch,
    #[msg("Component lives on a different token program")]
    WrongTokenProgram,
    #[msg("Component mint does not match the basket recipe")]
    ComponentMintMismatch,
    #[msg("Wrong number of accounts for this basket")]
    AccountCountMismatch,
    #[msg("Vault is not the basket's associated token account")]
    VaultMismatch,
    #[msg("Token account belongs to a different mint")]
    TokenAccountMintMismatch,
    #[msg("Mint account data is malformed")]
    MalformedMint,
    #[msg("Token account data is malformed")]
    MalformedTokenAccount,
    #[msg("Creator share account is required when a creator fee is set")]
    MissingCreatorShareAccount,
    #[msg("Share amount must be greater than zero")]
    ZeroShares,
    #[msg("Share amount is too small to deposit against")]
    DustMint,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
