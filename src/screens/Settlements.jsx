/**
 * Compute optimized peer-to-peer settlements.
 * Uses a greedy min-transfer algorithm.
 *
 * @param {Array<{id, name, balance}>} players - positive balance = creditor, negative = debtor
 * @returns {Array<{from_player_id, from_player_name, to_player_id, to_player_name, required_amount}>}
 */
export function computeSettlements(players) {
  // Filter to players with non-zero balances
  const creditors = players
    .filter(p => p.balance > 0)
    .map(p => ({ ...p, remaining: p.balance }))
    .sort((a, b) => b.remaining - a.remaining)

  const debtors = players
    .filter(p => p.balance < 0)
    .map(p => ({ ...p, remaining: Math.abs(p.balance) }))
    .sort((a, b) => b.remaining - a.remaining)

  const transfers = []

  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]
    const debtor = debtors[di]

    const amount = Math.min(creditor.remaining, debtor.remaining)

    if (amount > 0) {
      transfers.push({
        from_player_id: debtor.id,
        from_player_name: debtor.name,
        to_player_id: creditor.id,
        to_player_name: creditor.name,
        required_amount: amount,
      })
    }

    creditor.remaining -= amount
    debtor.remaining -= amount

    if (creditor.remaining === 0) ci++
    if (debtor.remaining === 0) di++
  }

  return transfers
}

/**
 * Given game_players with ending_chips set and their buyins,
 * compute balances for each player.
 */
export function computeBalances(gamePlayers, buyins, rate = 20) {
  return gamePlayers.map(gp => {
    const playerBuyins = buyins.filter(b => b.game_player_id === gp.id && !b.deleted_at)
    const totalBuyinsIls = playerBuyins.reduce((sum, b) => sum + b.amount_ils, 0)
    const endingChips = gp.ending_chips ?? 0
    // Convert ending chips back to ILS using rate
    const endingIls = Math.round(endingChips / rate * 20)
    const balance = endingIls - totalBuyinsIls

    return {
      id: gp.id,
      player_id: gp.player_id,
      name: gp.player_name,
      totalBuyinsIls,
      buysCount: playerBuyins.length,
      endingChips,
      endingIls,
      balance,
    }
  })
}

/**
 * Compute paid amount and remaining for a settlement given its payments
 */
export function settlementStatus(settlement, payments) {
  const paid = payments
    .filter(p => p.settlement_id === settlement.id)
    .reduce((sum, p) => sum + p.amount, 0)

  const remaining = settlement.required_amount - paid

  let status = 'unpaid'
  if (paid >= settlement.required_amount) status = 'paid'
  else if (paid > 0) status = 'partial'

  return { paid, remaining, status }
}
