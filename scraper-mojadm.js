const { launchBrowser, closeBrowser, DEFAULT_USER_AGENT } = require('./lib/browser');

async function scrapeProductDetails(page, link, basicInfo) {
    try {
        await page.goto(link, { waitUntil: 'networkidle0', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 1000));

        const details = await page.evaluate(() => {
            const result = {
                description: [],
                dmNumber: '',
                ean: '',
                properties: [],
                ingredients: ''
            };

            const bodyText = document.body.textContent;

            const descMatch = bodyText.match(/Popis produktu([\s\S]*?)(?:dm-číslo produktu|Vlastnosti|$)/);
            if (descMatch) {
                result.description = descMatch[1].split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 5 && !line.includes('Creme') && !line.startsWith('NIVEA'))
                    .slice(0, 10);
            }

            const dmMatch = bodyText.match(/dm-číslo produktu:\s*(\d+)/);
            if (dmMatch) result.dmNumber = dmMatch[1];

            const eanMatch = bodyText.match(/EAN:\s*(\d+)/);
            if (eanMatch) result.ean = eanMatch[1];

            const vlastnostiMatch = bodyText.match(/Vlastnosti([\s\S]*?)(?:Zložky|$)/);
            if (vlastnostiMatch) {
                result.properties = vlastnostiMatch[1].split('\n')
                    .map(line => line.trim())
                    .filter(line => line.includes(':'))
                    .slice(0, 10);
            }

            const zlozkyMatch = bodyText.match(/Zložky([\s\S]*?)(?:Upozornenie|Obsah|$)/);
            if (zlozkyMatch) {
                result.ingredients = zlozkyMatch[1].trim().substring(0, 500);
            }

            return result;
        });

        const bodyParts = [];
        if (basicInfo.body) bodyParts.push(basicInfo.body);
        if (details.description.length > 0) bodyParts.push('\nPopis: ' + details.description.join('; '));
        if (details.dmNumber) bodyParts.push(`dm-číslo: ${details.dmNumber}`);
        if (details.ean) bodyParts.push(`EAN: ${details.ean}`);
        if (details.properties.length > 0) bodyParts.push('Vlastnosti: ' + details.properties.join('; '));
        if (details.ingredients) bodyParts.push(`Zložky: ${details.ingredients}`);

        return { ...basicInfo, body: bodyParts.join(' | ') };

    } catch (error) {
        return basicInfo;
    }
}

function extractProductsFromPage() {
    const items = [];
    const productCards = document.querySelectorAll('div[data-dmid="product-tile"]');

    productCards.forEach(card => {
        try {
            const linkEl = card.querySelector('a');
            if (!linkEl) return;

            const link = linkEl.href;
            const srOnly = card.querySelector('.sr-only');
            let heading = '';
            let brand = '';
            let price = '';

            if (srOnly) {
                const text = srOnly.textContent;
                const brandMatch = text.match(/Značka:\s*([^;]+)/);
                if (brandMatch) brand = brandMatch[1].trim();

                const nameMatch = text.match(/Názov produktu:\s*([^;]+)/);
                if (nameMatch) heading = nameMatch[1].trim();

                const priceMatch = text.match(/Cena:\s*([^;]+)/);
                if (priceMatch) price = priceMatch[1].trim().replace(/\s/g, ' ');
            }

            if (!heading) {
                const headingEl = card.querySelector('[data-dmid="product-title"]') ||
                    card.querySelector('h2') ||
                    card.querySelector('h3');
                heading = headingEl ? headingEl.textContent.trim() : '';
            }

            if (!price) {
                const priceEl = card.querySelector('[data-dmid="product-tile-price"]');
                price = priceEl ? priceEl.textContent.trim() : '';
            }

            const body = brand ? `${brand} - ${heading}` : heading;

            if (heading && link) {
                items.push({ heading, price, link, body: body || heading });
            }
        } catch (err) {
            // Skip individual product extraction errors
        }
    });

    return items;
}

async function fetchProductDetails(page, products, allItems, onProgress, abortSignal) {
    for (let i = 0; i < products.length; i += 3) {
        if (abortSignal?.aborted) {
            if (onProgress) onProgress('Scraping cancelled', allItems.length);
            throw new Error('Scraping cancelled');
        }

        const batch = products.slice(i, i + 3);
        for (const product of batch) {
            const detailed = await scrapeProductDetails(page, product.link, product);
            allItems.push(detailed);
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (onProgress) onProgress(`Processing product details (${allItems.length}/${products.length})...`, allItems.length);
    }
}

async function scrapeMojadm(startUrl, maxPages = Infinity, onProgress = null, abortSignal = null) {
    let browser, chrome;

    try {
        ({ browser, chrome } = await launchBrowser());
        const allItems = [];

        if (onProgress) onProgress('Starting mojadm.sk scrape...', 0);

        const useInfiniteScroll = maxPages === Infinity;

        if (useInfiniteScroll) {
            const page = await browser.newPage();

            try {
                await page.setUserAgent(DEFAULT_USER_AGENT);
                await page.goto(startUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                await page.waitForSelector('div[data-dmid="product-tile"]', { timeout: 15000 });

                let previousCount = 0;
                let buttonNotFoundCount = 0;
                let noNewProductsCount = 0;
                let clickAttempts = 0;
                const maxClickAttempts = 100;

                if (onProgress) onProgress('Loading products with infinite scroll...', 0);

                while (clickAttempts < maxClickAttempts) {
                    if (abortSignal?.aborted) {
                        if (onProgress) onProgress('Scraping cancelled', allItems.length);
                        throw new Error('Scraping cancelled');
                    }

                    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const buttonClicked = await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button, a'));
                        const loadMoreButton = buttons.find(btn => {
                            const text = btn.textContent.toLowerCase();
                            return text.includes('načítať viac') ||
                                text.includes('load more') ||
                                text.includes('viac produktov') ||
                                text.includes('show more');
                        });

                        if (loadMoreButton && loadMoreButton.offsetParent !== null) {
                            loadMoreButton.click();
                            return true;
                        }
                        return false;
                    });

                    if (buttonClicked) {
                        buttonNotFoundCount = 0;
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    } else {
                        buttonNotFoundCount++;
                        if (buttonNotFoundCount >= 5) break;
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }

                    const currentCount = await page.evaluate(() => {
                        return document.querySelectorAll('div[data-dmid="product-tile"]').length;
                    });

                    if (onProgress) onProgress(`Loading products (${currentCount} found)...`, 0);

                    if (currentCount === previousCount) {
                        noNewProductsCount++;
                        if (noNewProductsCount >= 3 && buttonNotFoundCount >= 2) break;
                    } else {
                        noNewProductsCount = 0;
                    }

                    previousCount = currentCount;
                    clickAttempts++;
                }

                const products = await page.evaluate(extractProductsFromPage);

                if (onProgress) onProgress(`Found ${products.length} products, fetching details...`, allItems.length);

                await fetchProductDetails(page, products, allItems, onProgress, abortSignal);

            } finally {
                await page.close();
            }

        } else {
            for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
                if (abortSignal?.aborted) {
                    if (onProgress) onProgress('Scraping cancelled', allItems.length);
                    throw new Error('Scraping cancelled');
                }

                const pageUrl = startUrl.replace(/currentPage=\d+/, `currentPage=${currentPage}`);

                const page = await browser.newPage();

                try {
                    await page.setUserAgent(DEFAULT_USER_AGENT);
                    await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                    await page.waitForSelector('div[data-dmid="product-tile"]', { timeout: 15000 });

                    const products = await page.evaluate(extractProductsFromPage);

                    await fetchProductDetails(page, products, allItems, onProgress, abortSignal);

                } catch (error) {
                    // Continue to next page on error
                } finally {
                    await page.close();
                }

                if (allItems.length === 0 && currentPage === 1) break;

                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return allItems;

    } finally {
        await closeBrowser(browser, chrome);
    }
}

module.exports = { scrapeMojadm };
