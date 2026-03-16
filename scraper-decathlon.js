const { launchBrowser, closeBrowser, DEFAULT_USER_AGENT } = require('./lib/browser');

async function scrapeDecathlon(startUrl, maxPages = Infinity, onProgress = null, abortSignal = null) {
    let browser, chrome;

    try {
        ({ browser, chrome } = await launchBrowser());
        const allItems = [];

        if (onProgress) onProgress('Starting decathlon.sk scrape...', 0);

        const urlObj = new URL(startUrl);
        const baseUrl = startUrl.split('?')[0];
        const existingParams = urlObj.searchParams;

        const pagesToScrape = maxPages === Infinity ? 10 : Math.min(maxPages, 20);

        for (let currentPage = 1; currentPage <= pagesToScrape; currentPage++) {
            if (abortSignal?.aborted) {
                if (onProgress) onProgress('Scraping cancelled', allItems.length);
                throw new Error('Scraping cancelled');
            }

            let pageUrl;
            if (currentPage === 1) {
                pageUrl = startUrl;
            } else {
                const newUrl = new URL(baseUrl);
                existingParams.forEach((value, key) => {
                    if (key !== 'page') {
                        newUrl.searchParams.set(key, value);
                    }
                });
                newUrl.searchParams.set('page', currentPage);
                pageUrl = newUrl.toString();
            }

            if (onProgress) onProgress(`Loading page ${currentPage}...`, allItems.length);

            const page = await browser.newPage();

            try {
                await page.setUserAgent(DEFAULT_USER_AGENT);
                await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForSelector('a.js-product-card-link', { timeout: 15000 });
                await new Promise(resolve => setTimeout(resolve, 2000));

                const products = await page.evaluate(() => {
                    const items = [];
                    const productLinks = document.querySelectorAll('a.js-product-card-link');

                    productLinks.forEach(linkEl => {
                        try {
                            const link = linkEl.href;
                            const titleEl = linkEl.querySelector('h2');
                            if (!titleEl) return;

                            const heading = titleEl.textContent.trim();
                            if (!heading || heading.length < 3) return;

                            let price = 'N/A';
                            const cardText = linkEl.textContent.replace(heading, '');
                            const priceMatch = cardText.match(/(\d+[,\s]*\d*[,.]\d{2}\s*€)/);
                            if (priceMatch) {
                                price = priceMatch[1].replace(/\s/g, ' ').trim();
                            }

                            const bodyParts = [heading];
                            const descEl = linkEl.querySelector('.product-desc, .description, [class*="desc"]');
                            if (descEl) {
                                const desc = descEl.textContent.trim();
                                if (desc && desc.length > 10 && desc !== heading) {
                                    bodyParts.push(desc.substring(0, 300));
                                }
                            }

                            items.push({
                                heading,
                                price,
                                link,
                                body: bodyParts.join(' | ')
                            });
                        } catch (err) {
                            // Skip individual product extraction errors
                        }
                    });

                    return items;
                });

                if (products.length === 0) {
                    await page.close();
                    break;
                }

                allItems.push(...products);
                if (onProgress) onProgress(`Added ${products.length} products from page ${currentPage} (${allItems.length} total)`, allItems.length);

            } catch (error) {
                await page.close();
                if (currentPage === 1) throw error;
                break;
            }

            await page.close();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return allItems;

    } finally {
        await closeBrowser(browser, chrome);
    }
}

module.exports = { scrapeDecathlon };
