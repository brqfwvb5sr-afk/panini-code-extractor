const COUNTRY_GROUPS = [
  ["ALG", "Algerien"],
  ["ARG", "Argentinien"],
  ["AUS", "Australien"],
  ["AUT", "Österreich"],
  ["BEL", "Belgien"],
  ["BIH", "Bosnien und Herzegowina"],
  ["BRA", "Brasilien"],
  ["CAN", "Kanada"],
  ["CIV", "Côte d'Ivoire"],
  ["COD", "DR Kongo"],
  ["COL", "Kolumbien"],
  ["CPV", "Cabo Verde"],
  ["CRO", "Kroatien"],
  ["CUW", "Curaçao"],
  ["CZE", "Tschechien"],
  ["ECU", "Ecuador"],
  ["EGY", "Ägypten"],
  ["ENG", "England"],
  ["ESP", "Spanien"],
  ["FRA", "Frankreich"],
  ["GER", "Deutschland"],
  ["GHA", "Ghana"],
  ["HAI", "Haiti"],
  ["IRN", "Iran"],
  ["IRQ", "Irak"],
  ["JOR", "Jordanien"],
  ["JPN", "Japan"],
  ["KOR", "Südkorea"],
  ["KSA", "Saudiarabien"],
  ["MAR", "Marokko"],
  ["MEX", "Mexiko"],
  ["NED", "Niederlande"],
  ["NOR", "Norwegen"],
  ["NZL", "Neuseeland"],
  ["PAN", "Panama"],
  ["PAR", "Paraguay"],
  ["POR", "Portugal"],
  ["QAT", "Katar"],
  ["RSA", "Südafrika"],
  ["SCO", "Schottland"],
  ["SEN", "Senegal"],
  ["SUI", "Schweiz"],
  ["SWE", "Schweden"],
  ["TUN", "Tunesien"],
  ["TUR", "Türkei"],
  ["URU", "Uruguay"],
  ["USA", "USA"],
  ["UZB", "Usbekistan"],
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
