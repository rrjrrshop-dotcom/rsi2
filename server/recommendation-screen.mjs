import {RECOMMENDATION_SCREEN_VERSION} from '../recommendation-policy.mjs';

export function passesFinancialScreen(balance) {
  if (!balance || ![balance.equity, balance.assets, balance.liabilities].every(Number.isFinite) ||
      balance.equity <= 0 || balance.liabilities < 0 || balance.assets <= balance.liabilities) return false;
  const {currentAssets, currentLiabilities} = balance;
  if (currentAssets === null && currentLiabilities === null) return true;
  return [currentAssets, currentLiabilities].every(Number.isFinite) && currentLiabilities >= 0 && currentAssets >= currentLiabilities;
}

function sharesAtClose(shares, splits, through) {
  if (!shares || shares.date > through) return null;
  let count = shares.count;
  for (const split of splits) {
    if (split.date > through) break;
    if (split.date > shares.date) {
      // A later report can restate historical balance-sheet shares after a split.
      if (!shares.fromCover && split.date <= shares.filed) return null;
      count *= split.to / split.from;
    }
  }
  return Number.isFinite(count) && count > 0 ? count : null;
}

/** Set the cutoff before applying the financial screen, using all comparable stocks in the scan. */
export function screenRecommendations(securities, fundamentals, closes, splits, through, excludedFraction = 0.30) {
  const stocks = securities.filter(security => security.kind === 'stock');
  const comparable = [];
  for (const {symbol} of stocks) {
    const facts = fundamentals.get(symbol);
    const shares = sharesAtClose(facts?.shares, splits.get(symbol) ?? [], through);
    const cap = closes.get(symbol) * shares;
    if (Number.isFinite(cap) && cap > 0) comparable.push({symbol, cap, balance: facts.balance});
  }

  comparable.sort((a, b) => a.cap - b.cap);
  const bottomCount = Math.ceil(comparable.length * excludedFraction);
  const cutoff = bottomCount ? comparable[bottomCount - 1].cap : null;
  const eligible = new Set();
  let excludedSmall = 0;
  let excludedFinancials = 0;
  for (const {symbol, cap, balance} of comparable) {
    if (cap <= cutoff) excludedSmall++;
    else if (!passesFinancialScreen(balance)) excludedFinancials++;
    else eligible.add(symbol);
  }

  return {
    eligible,
    summary: {version: RECOMMENDATION_SCREEN_VERSION, status: comparable.length ? 'applied' : 'unavailable', through,
      stocks: stocks.length, comparable: comparable.length, excludedSmall, excludedFinancials, eligible: eligible.size},
  };
}
