const { launchBrowser, closeBrowser, DEFAULT_USER_AGENT } = require('./lib/browser');

async function scrapeNay(startUrl, maxPages = Infinity, onProgress = null, abortSignal = null) {
    let browser, chrome;

    try {
        ({ browser, chrome } = await launchBrowser());
        const allItems = [];

        if (onProgress) onProgress('Starting nay.sk scrape...', 0);

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
                    newUrl.searchParams.set(key, value);
                });
                newUrl.searchParams.set('page', currentPage);
                pageUrl = newUrl.toString();
            }

            if (onProgress) onProgress(`Loading page ${currentPage}...`, allItems.length);

            const page = await browser.newPage();

            try {
                await page.setUserAgent(DEFAULT_USER_AGENT);
                await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForSelector('div.product-box', { timeout: 15000 });
                await new Promise(resolve => setTimeout(resolve, 1500));

                const products = await page.evaluate(() => {
                    const items = [];
                    const productBoxes = document.querySelectorAll('div.product-box');

                    productBoxes.forEach(box => {
                        try {
                            const titleEl = box.querySelector('h3 a');
                            if (!titleEl) return;

                            const heading = titleEl.textContent.trim();
                            const link = titleEl.href;
                            if (!heading || heading.length < 3) return;

                            let price = 'N/A';

                            const discountPriceEl = box.querySelector('.exponea-category-discount');
                            if (discountPriceEl) {
                                const priceMatch = discountPriceEl.textContent.match(/(\d+[,\s]*\d*[,.]\d{2}\s*€)/);
                                if (priceMatch) price = priceMatch[1].trim();
                            }

                            if (price === 'N/A') {
                                const priceBox = box.querySelector('.price-box');
                                if (priceBox) {
                                    const priceMatch = priceBox.textContent.match(/(\d+[,\s]*\d*[,.]\d{2}\s*€)/);
                                    if (priceMatch) price = priceMatch[1].trim();
                                }
                            }

                            const bodyParts = [heading];

                            const descEl = box.querySelector('.product-desc, .description, .spec-list');
                            if (descEl) {
                                const desc = descEl.textContent.trim();
                                if (desc && desc.length > 10) {
                                    bodyParts.push(desc.substring(0, 300));
                                }
                            }

                            const specs = box.querySelectorAll('ul li');
                            if (specs.length > 0) {
                                const specTexts = [];
                                specs.forEach((spec, i) => {
                                    if (i < 5) {
                                        const text = spec.textContent.trim();
                                        if (text.length > 0 && text.length < 100) {
                                            specTexts.push(text);
                                        }
                                    }
                                });
                                if (specTexts.length > 0) {
                                    bodyParts.push(specTexts.join('; '));
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

module.exports = { scrapeNay };
