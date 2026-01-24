const puppeteer = require('puppeteer-core');
const chromeLauncher = require('chrome-launcher');

async function launchBrowser() {
    // Launch Chrome using chrome-launcher with macOS path
    const chrome = await chromeLauncher.launch({
        chromePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
    });

    // Connect puppeteer to the Chrome instance
    const response = await fetch(`http://localhost:${chrome.port}/json/version`);
    const { webSocketDebuggerUrl } = await response.json();

    const browser = await puppeteer.connect({
        browserWSEndpoint: webSocketDebuggerUrl
    });

    return { browser, chrome };
}

function cleanText(text) {
    return text ? text.replace(/\s+/g, ' ').trim() : '';
}

async function scrapeNay(startUrl, maxPages = Infinity, onProgress = null, abortSignal = null) {
    let browser, chrome;

    try {
        ({ browser, chrome } = await launchBrowser());
        const allItems = [];

        console.error('Starting nay.sk scrape...');
        if (onProgress) onProgress('Starting nay.sk scrape...', 0);

        // Extract base URL parts for pagination
        const urlObj = new URL(startUrl);
        const baseUrl = startUrl.split('?')[0];
        const existingParams = urlObj.searchParams;

        // Determine how many pages to scrape (default to 10 if infinite)
        const pagesToScrape = maxPages === Infinity ? 10 : Math.min(maxPages, 20);

        for (let currentPage = 1; currentPage <= pagesToScrape; currentPage++) {
            // Check for cancellation
            if (abortSignal?.aborted) {
                console.error('Scraping cancelled by user');
                if (onProgress) onProgress('Scraping cancelled', allItems.length);
                throw new Error('Scraping cancelled');
            }

            // Construct page URL
            let pageUrl;
            if (currentPage === 1) {
                pageUrl = startUrl;
            } else {
                const newUrl = new URL(baseUrl);
                // Copy existing params
                existingParams.forEach((value, key) => {
                    newUrl.searchParams.set(key, value);
                });
                // Set page parameter
                newUrl.searchParams.set('page', currentPage);
                pageUrl = newUrl.toString();
            }

            console.error(`Scraping page ${currentPage}: ${pageUrl}`);
            if (onProgress) onProgress(`Loading page ${currentPage}...`, allItems.length);

            const page = await browser.newPage();

            try {
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait for products to load
                await page.waitForSelector('div.product-box', { timeout: 15000 });
                await new Promise(resolve => setTimeout(resolve, 1500));

                const products = await page.evaluate(() => {
                    const items = [];
                    const productBoxes = document.querySelectorAll('div.product-box');

                    productBoxes.forEach(box => {
                        try {
                            // Get title and link
                            const titleEl = box.querySelector('h3 a');
                            if (!titleEl) return;

                            const heading = titleEl.textContent.trim();
                            const link = titleEl.href;

                            if (!heading || heading.length < 3) return;

                            // Get price - try different selectors
                            let price = 'N/A';

                            // First try to find discounted price
                            const discountPriceEl = box.querySelector('.exponea-category-discount');
                            if (discountPriceEl) {
                                const priceText = discountPriceEl.textContent;
                                const priceMatch = priceText.match(/(\d+[,\s]*\d*[,.]\d{2}\s*€)/);
                                if (priceMatch) {
                                    price = priceMatch[1].trim();
                                }
                            }

                            // If no discount, try regular price
                            if (price === 'N/A') {
                                const priceBox = box.querySelector('.price-box');
                                if (priceBox) {
                                    const allText = priceBox.textContent;
                                    // Match price pattern like "198,90 €" or "559,00 €"
                                    const priceMatch = allText.match(/(\d+[,\s]*\d*[,.]\d{2}\s*€)/);
                                    if (priceMatch) {
                                        price = priceMatch[1].trim();
                                    }
                                }
                            }

                            // Collect body information
                            const bodyParts = [heading];

                            // Try to find product description or specs
                            const descEl = box.querySelector('.product-desc, .description, .spec-list');
                            if (descEl) {
                                const desc = descEl.textContent.trim();
                                if (desc && desc.length > 10) {
                                    bodyParts.push(desc.substring(0, 300));
                                }
                            }

                            // Look for any list items that might contain specs
                            const specs = box.querySelectorAll('ul li');
                            if (specs.length > 0) {
                                const specTexts = [];
                                specs.forEach((spec, i) => {
                                    if (i < 5) { // Limit to 5 specs
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
                            console.error('Error extracting product:', err);
                        }
                    });

                    return items;
                });

                console.error(`Found ${products.length} products on page ${currentPage}`);

                if (products.length === 0) {
                    console.error('No products found on this page, stopping pagination.');
                    await page.close();
                    break;
                }

                // Add products to results
                allItems.push(...products);
                if (onProgress) onProgress(`Added ${products.length} products from page ${currentPage} (${allItems.length} total)`, allItems.length);

            } catch (error) {
                console.error(`Error on page ${currentPage}:`, error.message);
                await page.close();
                // If first page fails, throw error, otherwise continue
                if (currentPage === 1) {
                    throw error;
                }
                break;
            }

            await page.close();

            // Small delay between pages
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.error(`\nScraping complete. ${allItems.length} items found.`);
        return allItems;

    } catch (error) {
        console.error('Scraping error:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.disconnect();
        }
        if (chrome) {
            await chrome.kill();
        }
    }
}

module.exports = { scrapeNay };
