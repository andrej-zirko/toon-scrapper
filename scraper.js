const axios = require('axios');
const cheerio = require('cheerio');
const { program } = require('commander');

async function fetchHtml(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    return data;
  } catch (error) {
    console.error(`Error fetching ${url}: ${error.message}`);
    return null;
  }
}

function cleanText(text) {
  return text ? text.replace(/\s+/g, ' ').trim() : '';
}

async function scrapeItem(link, basicInfo) {
  const html = await fetchHtml(link);
  if (!html) return { ...basicInfo, body: '' };

  const $ = cheerio.load(html);
  const body = cleanText($('.popisdetail').text());

  return {
    ...basicInfo,
    body: body || basicInfo.summary // Fallback to summary if detailed body is missing
  };
}

async function scrapeBazos(startUrl, maxPages = Infinity, onProgress = null, abortSignal = null) {
  let currentUrl = startUrl;
  let pageCount = 0;
  const allItems = [];

  console.error('Starting scrape...');
  if (onProgress) onProgress('Starting Bazos scrape...', 0);

  while (currentUrl && pageCount < maxPages) {
    // Check for cancellation
    if (abortSignal?.aborted) {
      console.error('Scraping cancelled by user');
      if (onProgress) onProgress('Scraping cancelled', allItems.length);
      throw new Error('Scraping cancelled');
    }

    console.error(`Scraping page ${pageCount + 1}: ${currentUrl}`);
    const html = await fetchHtml(currentUrl);
    if (!html) break;

    const $ = cheerio.load(html);
    const items = [];

    $('.inzeraty.inzeratyflex').each((i, el) => {
      const $el = $(el);
      const titleEl = $el.find('.inzeratynadpis .nadpis a');
      const link = titleEl.attr('href');

      const fullLink = link ? (link.startsWith('http') ? link : `https://pc.bazos.sk${link}`) : null;

      if (fullLink) {
        items.push({
          heading: cleanText(titleEl.text()),
          price: cleanText($el.find('.inzeratycena b').text()),
          link: fullLink,
          summary: cleanText($el.find('.inzeratynadpis .popis').text())
        });
      }
    });

    if (items.length === 0) {
      console.error('No items found on this page.');
      break;
    }

    for (let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5);
      const promises = batch.map(item => scrapeItem(item.link, item));
      const results = await Promise.all(promises);
      allItems.push(...results);
      if (onProgress) onProgress(`Scraping page ${pageCount + 1}...`, allItems.length);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    pageCount++;

    const nextLinkEl = $('.strankovani a:contains("Ďalšia")');
    if (nextLinkEl.length > 0) {
      const nextHref = nextLinkEl.attr('href');
      currentUrl = nextHref ? (nextHref.startsWith('http') ? nextHref : `https://www.bazos.sk/${nextHref}`) : null;
    } else {
      currentUrl = null;
    }

    if (pageCount >= maxPages) break;
  }

  console.error(`\nScraping complete. ${allItems.length} items found.`);
  return allItems;
}

// CLI Interface
if (require.main === module) {
  program
    .requiredOption('-u, --url <url>', 'URL to scrape')
    .option('-p, --pages <number>', 'Max pages to scrape', parseInt)
    .parse(process.argv);

  const options = program.opts();

  scrapeBazos(options.url, options.pages)
    .then(items => {
      console.log('| heading | body | price | link |');
      items.forEach(item => {
        const heading = item.heading.replace(/\|/g, '/');
        const body = item.body.replace(/\|/g, '/');
        const price = item.price.replace(/\|/g, '/');
        const link = item.link;
        console.log(`| "${heading}" | "${body}" | "${price}" | "${link}" |`);
      });
    })
    .catch(err => console.error(err));
}

module.exports = { scrapeBazos };

