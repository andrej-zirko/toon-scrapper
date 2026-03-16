const BAZOS_DOMAINS = ['bazos.sk', 'pc.bazos.sk', 'www.bazos.sk', 'auto.bazos.sk', 'dom.bazos.sk', 'elektro.bazos.sk', 'hudba.bazos.sk', 'knihy.bazos.sk', 'mobily.bazos.sk', 'motocykle.bazos.sk', 'nabytok.bazos.sk', 'oblecenie.bazos.sk', 'sluzby.bazos.sk', 'sport.bazos.sk', 'stroje.bazos.sk', 'vstupenky.bazos.sk', 'zvierata.bazos.sk', 'deti.bazos.sk', 'ostatne.bazos.sk'];
const MOJADM_DOMAINS = ['mojadm.sk', 'www.mojadm.sk'];
const ALZA_DOMAINS = ['alza.sk', 'www.alza.sk'];
const NAY_DOMAINS = ['nay.sk', 'www.nay.sk'];
const DECATHLON_DOMAINS = ['decathlon.sk', 'www.decathlon.sk'];
const ALLOWED_DOMAINS = [...BAZOS_DOMAINS, ...MOJADM_DOMAINS, ...ALZA_DOMAINS, ...NAY_DOMAINS, ...DECATHLON_DOMAINS];
const MAX_PAGES = 20;

function parsePages(pagesParam) {
  if (!pagesParam) return Infinity;
  const parsed = parseInt(pagesParam, 10);
  if (isNaN(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_PAGES);
}

function isDomainAllowed(hostname) {
  return ALLOWED_DOMAINS.includes(hostname);
}

function getDomainGroup(hostname) {
  if (BAZOS_DOMAINS.includes(hostname)) return 'bazos';
  if (MOJADM_DOMAINS.includes(hostname)) return 'mojadm';
  if (ALZA_DOMAINS.includes(hostname)) return 'alza';
  if (NAY_DOMAINS.includes(hostname)) return 'nay';
  if (DECATHLON_DOMAINS.includes(hostname)) return 'decathlon';
  return null;
}

module.exports = {
  BAZOS_DOMAINS,
  MOJADM_DOMAINS,
  ALZA_DOMAINS,
  NAY_DOMAINS,
  DECATHLON_DOMAINS,
  ALLOWED_DOMAINS,
  MAX_PAGES,
  parsePages,
  isDomainAllowed,
  getDomainGroup,
};
