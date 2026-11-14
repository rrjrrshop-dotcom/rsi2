export const RECOMMENDATION_LIMIT = 6;
export const RECOMMENDATION_SCREEN_VERSION = 2;
export const RECOMMENDATION_INDEXES = Object.freeze({nasdaq100: '나스닥 100', sp500: 'S&P 500', dow: '다우'});
export const RECOMMENDATION_SCOPE = 'nasdaq100-sp500-dow';

export function hasCurrentRecommendationScreen(result) {
  const screen = result?.preliminary?.recommendationScreen;
  return screen?.version === RECOMMENDATION_SCREEN_VERSION && screen.scope === RECOMMENDATION_SCOPE &&
    screen.status === 'applied' && screen.through === result.expectedDate;
}
