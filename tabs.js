/* Each strategy owns its panel. Existing RSI2 state and API remain unchanged. */
const tabs = [...document.querySelectorAll('[data-strategy]')];
function activateStrategy(id, focus = false) {
  const target = tabs.find(tab => tab.dataset.strategy === id);
  if (!target) return;
  for (const tab of tabs) {
    const selected = tab === target;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
  }
  if (focus) target.focus();
}
for (const tab of tabs) {
  tab.addEventListener('click', () => activateStrategy(tab.dataset.strategy));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    activateStrategy(tabs[next].dataset.strategy, true);
  });
}
