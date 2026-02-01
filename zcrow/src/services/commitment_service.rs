use crate::config::APP_OWNER_WALLET;
use crate::db::{commitment_repo, transaction_repo, user_repo};
use commitment_repo::{CommitmentRow, CommitmentStatus, CreateCommitmentInput};
use sqlx::PgPool;
use thiserror::Error;
use transaction_repo::{CreateTransactionInput, TxnKind};
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum CommitmentError {
    #[error("Commitment not found")]
    NotFound,
    #[error("Not authorized to perform this action")]
    Unauthorized,
    #[error("Invalid status transition: cannot go from {0} to {1}")]
    InvalidStatusTransition(String, String),
    #[error("Commitment already has an opponent")]
    AlreadyHasOpponent,
    #[error("Cannot join own commitment")]
    CannotJoinOwn,
    #[error("Database error: {0}")]
    Database(#[from] anyhow::Error),
}

/// Create a new commitment
/// For solo stakes (no opponent), automatically activate
pub async fn create_commitment(
    pool: &PgPool,
    creator_id: Uuid,
    input: CreateCommitmentInput,
) -> Result<CommitmentRow, CommitmentError> {
    let commitment = commitment_repo::create(pool, creator_id, &input).await?;
    
    // Log the event
    log_event(
        pool,
        commitment.id,
        None,
        "pending",
        Some(creator_id),
        "user",
        Some("Commitment created"),
    )
    .await?;

    // Check if this is a solo stake (no opponent specified)
    let is_solo = input.opponent_wallet.is_none() && input.opponent_id.is_none();
    
    if is_solo {
        // For solo stakes, auto-activate immediately
        let updated = commitment_repo::update_status(pool, commitment.id, CommitmentStatus::Active).await?;
        
        // Create lock transaction for the stake
        transaction_repo::create(
            pool,
            &CreateTransactionInput {
                user_id: creator_id,
                commitment_id: Some(commitment.id),
                kind: TxnKind::Lock,
                amount: commitment.amount,
                currency: commitment.currency.clone(),
                tx_signature: Some(format!("solo-stake-{}", commitment.id)),
                ref_id: None,
                meta: None,
            },
        )
        .await?;
        
        log_event(
            pool,
            commitment.id,
            Some("pending"),
            "active",
            None,
            "system",
            Some("Solo stake auto-activated"),
        )
        .await?;
        
        return Ok(updated);
    }

    Ok(commitment)
}

/// Get a commitment by ID
pub async fn get_commitment(pool: &PgPool, id: Uuid) -> Result<CommitmentRow, CommitmentError> {
    commitment_repo::get_by_id(pool, id)
        .await?
        .ok_or(CommitmentError::NotFound)
}

/// List commitments for a user
pub async fn list_user_commitments(
    pool: &PgPool,
    user_id: Uuid,
    limit: i64,
    offset: i64,
) -> Result<Vec<CommitmentRow>, CommitmentError> {
    Ok(commitment_repo::list_for_user(pool, user_id, limit, offset).await?)
}

/// List open challenges (for joining)
pub async fn list_open_challenges(
    pool: &PgPool,
    user_id: Uuid,
    limit: i64,
    offset: i64,
) -> Result<Vec<CommitmentRow>, CommitmentError> {
    Ok(commitment_repo::list_open_challenges(pool, user_id, limit, offset).await?)
}

/// List challenges directed at a specific user
pub async fn list_challenges_for_user(
    pool: &PgPool,
    user_id: Uuid,
    wallet_pubkey: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<CommitmentRow>, CommitmentError> {
    Ok(commitment_repo::list_challenges_for_user(pool, user_id, wallet_pubkey, limit, offset).await?)
}

/// Join a commitment as opponent
/// Auto-activates the commitment after joining
pub async fn join_commitment(
    pool: &PgPool,
    commitment_id: Uuid,
    opponent_id: Uuid,
) -> Result<CommitmentRow, CommitmentError> {
    let commitment = get_commitment(pool, commitment_id).await?;

    // Validate
    if commitment.creator_id == opponent_id {
        return Err(CommitmentError::CannotJoinOwn);
    }
    if commitment.opponent_id.is_some() {
        return Err(CommitmentError::AlreadyHasOpponent);
    }
    if commitment.status != CommitmentStatus::Pending {
        return Err(CommitmentError::InvalidStatusTransition(
            commitment.status.to_string(),
            "joined".to_string(),
        ));
    }

    let updated = commitment_repo::set_opponent(pool, commitment_id, opponent_id).await?;

    log_event(
        pool,
        commitment_id,
        Some("pending"),
        "pending",
        Some(opponent_id),
        "user",
        Some("Opponent joined commitment"),
    )
    .await?;

    // Create lock transactions for both parties
    transaction_repo::create(
        pool,
        &CreateTransactionInput {
            user_id: commitment.creator_id,
            commitment_id: Some(commitment_id),
            kind: TxnKind::Lock,
            amount: commitment.amount,
            currency: commitment.currency.clone(),
            tx_signature: Some(format!("join-lock-creator-{}", commitment_id)),
            ref_id: None,
            meta: None,
        },
    )
    .await?;

    transaction_repo::create(
        pool,
        &CreateTransactionInput {
            user_id: opponent_id,
            commitment_id: Some(commitment_id),
            kind: TxnKind::Lock,
            amount: commitment.amount,
            currency: commitment.currency.clone(),
            tx_signature: Some(format!("join-lock-opponent-{}", commitment_id)),
            ref_id: None,
            meta: None,
        },
    )
    .await?;

    // Auto-activate the commitment
    let activated = commitment_repo::update_status(pool, commitment_id, CommitmentStatus::Active).await?;
    
    log_event(
        pool,
        commitment_id,
        Some("pending"),
        "active",
        None,
        "system",
        Some("Commitment activated after opponent joined"),
    )
    .await?;

    Ok(activated)
}

/// Record creator's deposit
pub async fn record_creator_deposit(
    pool: &PgPool,
    commitment_id: Uuid,
    user_id: Uuid,
    tx_signature: &str,
) -> Result<CommitmentRow, CommitmentError> {
    let commitment = get_commitment(pool, commitment_id).await?;

    if commitment.creator_id != user_id {
        return Err(CommitmentError::Unauthorized);
    }

    // Record the deposit
    let updated = commitment_repo::set_creator_deposit(pool, commitment_id, tx_signature).await?;

    // Create transaction record
    transaction_repo::create(
        pool,
        &CreateTransactionInput {
            user_id,
            commitment_id: Some(commitment_id),
            kind: TxnKind::Lock,
            amount: commitment.amount,
            currency: commitment.currency.clone(),
            tx_signature: Some(tx_signature.to_string()),
            ref_id: None,
            meta: None,
        },
    )
    .await?;

    log_event(
        pool,
        commitment_id,
        Some(&commitment.status.to_string()),
        &commitment.status.to_string(),
        Some(user_id),
        "user",
        Some("Creator deposited funds"),
    )
    .await?;

    // Check if both deposits are done
    maybe_activate_commitment(pool, commitment_id).await?;

    Ok(updated)
}

/// Record opponent's deposit
pub async fn record_opponent_deposit(
    pool: &PgPool,
    commitment_id: Uuid,
    user_id: Uuid,
    tx_signature: &str,
) -> Result<CommitmentRow, CommitmentError> {
    let commitment = get_commitment(pool, commitment_id).await?;

    if commitment.opponent_id != Some(user_id) {
        return Err(CommitmentError::Unauthorized);
    }

    let updated = commitment_repo::set_opponent_deposit(pool, commitment_id, tx_signature).await?;

    // Create transaction record
    transaction_repo::create(
        pool,
        &CreateTransactionInput {
            user_id,
            commitment_id: Some(commitment_id),
            kind: TxnKind::Lock,
            amount: commitment.amount,
            currency: commitment.currency.clone(),
            tx_signature: Some(tx_signature.to_string()),
            ref_id: None,
            meta: None,
        },
    )
    .await?;

    log_event(
        pool,
        commitment_id,
        Some(&commitment.status.to_string()),
        &commitment.status.to_string(),
        Some(user_id),
        "user",
        Some("Opponent deposited funds"),
    )
    .await?;

    // Check if both deposits are done
    maybe_activate_commitment(pool, commitment_id).await?;

    Ok(updated)
}

/// Check if both deposits are done and activate the commitment
async fn maybe_activate_commitment(pool: &PgPool, commitment_id: Uuid) -> Result<(), CommitmentError> {
    let commitment = get_commitment(pool, commitment_id).await?;

    if commitment.tx_deposit_creator.is_some()
        && commitment.tx_deposit_opponent.is_some()
        && commitment.status == CommitmentStatus::Pending
    {
        commitment_repo::update_status(pool, commitment_id, CommitmentStatus::Locked).await?;
        
        log_event(
            pool,
            commitment_id,
            Some("pending"),
            "locked",
            None,
            "system",
            Some("Both deposits received, commitment locked"),
        )
        .await?;
    }

    Ok(())
}

/// Activate a locked commitment (start the commitment period)
pub async fn activate_commitment(
    pool: &PgPool,
    commitment_id: Uuid,
) -> Result<CommitmentRow, CommitmentError> {
    let commitment = get_commitment(pool, commitment_id).await?;

    if commitment.status != CommitmentStatus::Locked {
        return Err(CommitmentError::InvalidStatusTransition(
            commitment.status.to_string(),
            "active".to_string(),
        ));
    }

    let updated = commitment_repo::update_status(pool, commitment_id, CommitmentStatus::Active).await?;

    log_event(
        pool,
        commitment_id,
        Some("locked"),
        "active",
        None,
        "system",
        Some("Commitment activated"),
    )
    .await?;

    Ok(updated)
}

/// Move commitment to resolving state
pub async fn start_resolution(
    pool: &PgPool,
    commitment_id: Uuid,
) -> Result<CommitmentRow, CommitmentError> {
    let commitment = get_commitment(pool, commitment_id).await?;

    if commitment.status != CommitmentStatus::Active {
        return Err(CommitmentError::InvalidStatusTransition(
            commitment.status.to_string(),
            "resolving".to_string(),
        ));
    }

    let updated = commitment_repo::update_status(pool, commitment_id, CommitmentStatus::Resolving).await?;

    log_event(
        pool,
        commitment_id,
        Some("active"),
        "resolving",
        None,
        "system",
        Some("Commitment period ended, awaiting resolution"),
    )
    .await?;

    Ok(updated)
}

/// Settle the commitment with a winner
/// For solo stakes where user wins, they get their stake back
/// For solo stakes where user loses, stake is forfeited
pub async fn settle_commitment(
    pool: &PgPool,
    commitment_id: Uuid,
    winner_id: Uuid,
    tx_settle: &str,
) -> Result<CommitmentRow, CommitmentError> {
    let commitment = get_commitment(pool, commitment_id).await?;

    if commitment.status != CommitmentStatus::Resolving && commitment.status != CommitmentStatus::Active {
        return Err(CommitmentError::InvalidStatusTransition(
            commitment.status.to_string(),
            "released".to_string(),
        ));
    }

    // Check if solo stake
    let is_solo = commitment.opponent_id.is_none();
    
    // Verify winner is a participant (for non-solo stakes)
    if !is_solo && commitment.creator_id != winner_id && commitment.opponent_id != Some(winner_id) {
        return Err(CommitmentError::Unauthorized);
    }

    let updated = commitment_repo::settle(pool, commitment_id, winner_id, tx_settle).await?;

    // Create release transaction for winner
    if is_solo {
        // Solo stake: winner gets their stake back
        if winner_id == commitment.creator_id {
            // User won solo stake - release their stake back
            transaction_repo::create(
                pool,
                &CreateTransactionInput {
                    user_id: winner_id,
                    commitment_id: Some(commitment_id),
                    kind: TxnKind::Release,
                    amount: commitment.amount,
                    currency: commitment.currency.clone(),
                    tx_signature: Some(tx_settle.to_string()),
                    ref_id: None,
                    meta: Some(serde_json::json!({"solo_stake": true, "result": "won"})),
                },
            )
            .await?;
        } else {
            // User lost solo stake - transfer stake to app owner
            // Get or create app owner user
            let app_owner = user_repo::get_or_create_by_wallet(pool, APP_OWNER_WALLET).await?;
            
            transaction_repo::create(
                pool,
                &CreateTransactionInput {
                    user_id: app_owner.id,
                    commitment_id: Some(commitment_id),
                    kind: TxnKind::Credit,
                    amount: commitment.amount,
                    currency: commitment.currency.clone(),
                    tx_signature: Some(tx_settle.to_string()),
                    ref_id: None,
                    meta: Some(serde_json::json!({"solo_stake_forfeit": true, "from_user": commitment.creator_id})),
                },
            )
            .await?;
        }
    } else {
        // Head-to-head: winner receives both amounts
        let total_amount = commitment.amount * 2;
        transaction_repo::create(
            pool,
            &CreateTransactionInput {
                user_id: winner_id,
                commitment_id: Some(commitment_id),
                kind: TxnKind::Release,
                amount: total_amount,
                currency: commitment.currency.clone(),
                tx_signature: Some(tx_settle.to_string()),
                ref_id: None,
                meta: None,
            },
        )
        .await?;
    }

    log_event(
        pool,
        commitment_id,
        Some(&commitment.status.to_string()),
        "released",
        Some(winner_id),
        "system",
        Some(&format!("Commitment settled, winner: {}", winner_id)),
    )
    .await?;

    Ok(updated)
}

/// Cancel a commitment (only if pending and no opponent yet)
pub async fn cancel_commitment(
    pool: &PgPool,
    commitment_id: Uuid,
    user_id: Uuid,
) -> Result<CommitmentRow, CommitmentError> {
    let commitment = get_commitment(pool, commitment_id).await?;

    // Only creator can cancel
    if commitment.creator_id != user_id {
        return Err(CommitmentError::Unauthorized);
    }

    // Can only cancel pending commitments without deposits
    if commitment.status != CommitmentStatus::Pending {
        return Err(CommitmentError::InvalidStatusTransition(
            commitment.status.to_string(),
            "cancelled".to_string(),
        ));
    }

    let updated = commitment_repo::cancel(pool, commitment_id).await?;

    log_event(
        pool,
        commitment_id,
        Some("pending"),
        "cancelled",
        Some(user_id),
        "user",
        Some("Commitment cancelled by creator"),
    )
    .await?;

    Ok(updated)
}

/// Log a commitment event (public version for routes)
pub async fn log_event_public(
    pool: &PgPool,
    commitment_id: Uuid,
    from_status: Option<&str>,
    to_status: &str,
    actor_id: Option<Uuid>,
    actor_type: &str,
    note: Option<&str>,
) -> Result<(), CommitmentError> {
    log_event(pool, commitment_id, from_status, to_status, actor_id, actor_type, note).await
}

/// Log a commitment event
async fn log_event(
    pool: &PgPool,
    commitment_id: Uuid,
    from_status: Option<&str>,
    to_status: &str,
    actor_id: Option<Uuid>,
    actor_type: &str,
    note: Option<&str>,
) -> Result<(), CommitmentError> {
    sqlx::query(
        r#"
        INSERT INTO commitment_events (commitment_id, from_status, to_status, actor_id, actor_type, note)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(commitment_id)
    .bind(from_status)
    .bind(to_status)
    .bind(actor_id)
    .bind(actor_type)
    .bind(note)
    .execute(pool)
    .await
    .map_err(|e| CommitmentError::Database(e.into()))?;

    Ok(())
}
