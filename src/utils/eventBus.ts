export const triggerGlobalSearch = (keyword: string) => {
  window.dispatchEvent(new CustomEvent('globalSearch', { detail: keyword }));
};
