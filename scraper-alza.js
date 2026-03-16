const { launchBrowser, closeBrowser, DEFAULT_USER_AGENT } = require('./lib/browser');

async function scrapeAlza(startUrl, maxPages = Infinity, onProgress = null, abortSignal = null) {
    let browser, chrome;

    try {
        ({ browser, chrome } = await launchBrowser());
        const allItems = [];
        const seenLinks = new Set();

        if (onProgress) onProgress('Starting alza.sk scrape...', 0);

        const urlMatch = startUrl.match(/\/(\d+)(-p\d+)?\.htm/);
        if (!urlMatch) {
            throw new Error('Could not extract base ID from Alza URL');
        }
        const baseId = urlMatch[1];

        const hashIndex = startUrl.indexOf('#');
        const hashFragment = hashIndex !== -1 ? startUrl.substring(hashIndex) : '';
        const baseUrl = hashIndex !== -1 ? startUrl.substring(0, hashIndex) : startUrl;

        const pagesToScrape = maxPages === Infinity ? 20 : Math.min(maxPages, 20);

        for (let currentPage = 1; currentPage <= pagesToScrape; currentPage++) {
            if (abortSignal?.aborted) {
                if (onProgress) onProgress('Scraping cancelled', allItems.length);
                throw new Error('Scraping cancelled');
            }

            let currentHash = hashFragment;
            if (currentHash && currentHash.includes('pg=')) {
                currentHash = currentHash.replace(/pg=\d+/, `pg=${currentPage}`);
            }

            let pageUrl;
            if (currentPage === 1) {
                pageUrl = baseUrl.replace(/-p\d+/, '') + currentHash;
            } else {
                pageUrl = baseUrl.replace(/\/(\d+)(-p\d+)?\.htm/, `/${baseId}-p${currentPage}.htm`) + currentHash;
            }

            if (onProgress) onProgress(`Loading page ${currentPage}...`, allItems.length);

            const page = await browser.newPage();

            try {
                await page.setUserAgent(DEFAULT_USER_AGENT);
                await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(resolve => setTimeout(resolve, 2000));
                await page.waitForSelector('a.browsinglink', { timeout: 15000 });

                const products = await page.evaluate(() => {
                    const items = [];
                    const productLinks = document.querySelectorAll('a.browsinglink.name, a.browsinglink');

                    productLinks.forEach(linkEl => {
                        try {
                            if (!linkEl.classList.contains('name')) return;

                            const link = linkEl.href;
                            const heading = linkEl.textContent.trim();
                            if (!heading || heading.length < 3) return;

                            let price = 'N/A';
                            let parent = linkEl.closest('.box, .product-box, div[data-id], .cbox');
                            const bodyParts = [heading];

                            if (parent) {
                                const allText = parent.textContent;
                                const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const descMatch = allText.match(new RegExp(escapedHeading + "\\s+([\\s\\S]*?)(?:\\+Darček|\\d+\\s*€|Od \\d)"));
                                if (descMatch && descMatch[1]) {
                                    const desc = descMatch[1].trim();
                                    if (desc && desc !== heading && desc.length > 10) {
                                        bodyParts.push(desc.substring(0, 500));
                                    }
                                }

                                let priceEl = parent.querySelector('.coupon-block__price');
                                if (priceEl) {
                                    price = priceEl.textContent.trim().replace(/\s/g, ' ');
                                } else {
                                    priceEl = parent.querySelector('.price-box__primary-price');
                                    if (priceEl) {
                                        price = priceEl.textContent.trim().replace(/\s/g, ' ');
                                    } else {
                                        const priceMatch = allText.match(/(\d+(?:\s*\d+)*(?:[.,]\d{2})?\s*€)/);
                                        if (priceMatch) {
                                            price = priceMatch[1].trim();
                                        }
                                    }
                                }

                                const specs = parent.querySelectorAll('.spec, .parameter, [class*="spec"]');
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

                            if (heading && link) {
                                items.push({
                                    heading,
                                    price: price || 'N/A',
                                    link,
                                    body: bodyParts.length > 1 ? bodyParts.join(' | ') : heading
                                });
                            }
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

                const newItems = products.filter(p => {
                    if (seenLinks.has(p.link)) return false;
                    seenLinks.add(p.link);
                    return true;
                });

                if (newItems.length === 0 && products.length > 0) {
                    await page.close();
                    break;
                }

                allItems.push(...newItems);
                if (onProgress) onProgress(`Added ${newItems.length} new products from page ${currentPage} (${allItems.length} total)`, allItems.length);

                const hasNextPage = await page.evaluate(() => {
                    const nextBtn = document.querySelector('.next, .next-page, a[title="Ďalšia"], a.pager-next');
                    return !!nextBtn;
                });

                if (!hasNextPage) {
                    await page.close();
                    break;
                }
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

module.exports = { scrapeAlza };
