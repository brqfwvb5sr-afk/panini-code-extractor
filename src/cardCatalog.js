const COUNTRY_GROUPS = [
  ["MEX", "Mexiko"],
  ["RSA", "Südafrika"],
  ["KOR", "Südkorea"],
  ["CZE", "Tschechien"],
  ["CAN", "Kanada"],
  ["BIH", "Bosnien und Herzegowina"],
  ["QAT", "Katar"],
  ["SUI", "Schweiz"],
  ["BRA", "Brasilien"],
  ["MAR", "Marokko"],
  ["HAI", "Haiti"],
  ["SCO", "Schottland"],
  ["USA", "USA"],
  ["PAR", "Paraguay"],
  ["AUS", "Australien"],
  ["TUR", "Türkei"],
  ["GER", "Deutschland"],
  ["CUW", "Curaçao"],
  ["CIV", "Elfenbeinküste"],
  ["ECU", "Ecuador"],
  ["NED", "Niederlande"],
  ["JPN", "Japan"],
  ["SWE", "Schweden"],
  ["TUN", "Tunesien"],
  ["BEL", "Belgien"],
  ["EGY", "Ägypten"],
  ["IRN", "Iran"],
  ["NZL", "Neuseeland"],
  ["ESP", "Spanien"],
  ["CPV", "Kap Verde"],
  ["KSA", "Saudi-Arabien"],
  ["URU", "Uruguay"],
  ["FRA", "Frankreich"],
  ["SEN", "Senegal"],
  ["IRQ", "Irak"],
  ["NOR", "Norwegen"],
  ["ARG", "Argentinien"],
  ["ALG", "Algerien"],
  ["AUT", "Österreich"],
  ["JOR", "Jordanien"],
  ["POR", "Portugal"],
  ["COD", "DR Kongo"],
  ["UZB", "Usbekistan"],
  ["COL", "Kolumbien"],
  ["ENG", "England"],
  ["CRO", "Kroatien"],
  ["GHA", "Ghana"],
  ["PAN", "Panama"],
].map(([code, name]) => ({ code, name, total: 20 }));

const SPECIAL_GROUPS = [
  { code: "FWC", name: "FIFA World Cup", total: 19, aliases: ["FCW"] },
  { code: "CC", name: "Classic Cards", total: 12 },
];

function createCards(group) {
  return Array.from({ length: group.total }, (_, index) => {
    const number = index + 1;

    return {
      code: `${group.code}${number}`,
      groupCode: group.code,
      number,
    };
  });
}

export const GROUPS = [...SPECIAL_GROUPS, ...COUNTRY_GROUPS].map((group) => ({
  ...group,
  cards: createCards(group),
}));

export const CARDS = GROUPS.flatMap((group) => group.cards);
export const CARD_CODES = new Set(CARDS.map((card) => card.code));
export const TOTAL_CARDS = CARDS.length;
