export const formatModelCount = (count: number): string => {
  const lastTwo = count % 100;
  const last = count % 10;
  const noun = lastTwo >= 11 && lastTwo <= 14
    ? 'моделей'
    : last === 1 ? 'модель' : last >= 2 && last <= 4 ? 'модели' : 'моделей';
  return `${count} ${noun}`;
};
