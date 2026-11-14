export const RECOMMENDATION_LIMIT = 6;
export const RECOMMENDATION_SCREEN_VERSION = 2;
export const RECOMMENDATION_INDEXES = Object.freeze({nasdaq100: '나스닥 100', sp500: 'S&P 500', dow: '다우'});
export const RECOMMENDATION_SCOPE = 'nasdaq100-sp500-dow';
export const RECOMMENDATION_SCOPES = Object.freeze({
  major: {id: RECOMMENDATION_SCOPE, list: 'recommendations', screen: 'recommendationScreen', excludedFraction: 0.30},
  all: {id: 'us-listed-common-top-80', list: 'marketRecommendations', screen: 'marketRecommendationScreen', excludedFraction: 0.20},
});

export function hasCurrentRecommendationScreen(result, scope = 'major') {
  const {id, screen: key} = RECOMMENDATION_SCOPES[scope];
  const screen = result?.preliminary?.[key];
  return screen?.version === RECOMMENDATION_SCREEN_VERSION && screen.scope === id &&
    screen.status === 'applied' && screen.through === result.expectedDate;
}
