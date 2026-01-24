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

async function scrapeProductDetails(page, link, basicInfo) {
    try {
        console.error(`  Fetching details for: ${basicInfo.heading}`);
        await page.goto(link, { waitUntil: 'networkidle0', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 1000));

        const details = await page.evaluate(() => {
            const result = {
                description: '',
                parameters: []
            };

            // Extract description from the description section
            const descEl = document.querySelector('.pd-desc') ||
                document.querySelector('.detail-information') ||
                document.querySelector('[data-testid="description"]');

            if (descEl) {
                result.description = descEl.textContent.trim().substring(0, 1000);
            }

            // Extract parameters from parameter table
            const paramRows = document.querySelectorAll('.parametrs tr, .parameters tr, .parameterRow');
            paramRows.forEach((row, i) => {
                if (i < 10) {
                    const text = row.textContent.trim();
                    if (text && text.includes(':')) {
                        result.parameters.push(text);
                    }
                }
            });

            return result;
        });

        // Format the body with all detailed information
        const bodyParts = [];

        if (basicInfo.body) {
            bodyParts.push(basicInfo.body);
        }

        if (details.description) {
            bodyParts.push(`Popis: ${details.description}`);
        }

        if (details.parameters.length > 0) {
            bodyParts.push('Parametre: ' + details.parameters.join('; '));
        }

        return {
            ...basicInfo,
            body: bodyParts.join(' | ') || basicInfo.heading
        };

    } catch (error) {
        console.error(`  Error fetching details for ${basicInfo.heading}:`, error.message);
        return basicInfo; // Return basic info if detail fetch fails
    }
}

async function scrapeAlza(startUrl, maxPages = Infinity, onProgress = null, abortSignal = null) {
    let browser, chrome;

    try {
        ({ browser, chrome } = await launchBrowser());
        const allItems = [];

        console.error('Starting alza.sk scrape...');
        if (onProgress) onProgress('Starting alza.sk scrape...', 0);

        // Extract base ID from URL for pagination
        const urlMatch = startUrl.match(/\/(\d+)(-p\d+)?\.htm/);
        if (!urlMatch) {
            throw new Error('Could not extract base ID from Alza URL');
        }
        const baseId = urlMatch[1];
        console.error(`Base ID: ${baseId}`);

        // Determine how many pages to scrape
        const pagesToScrape = maxPages === Infinity ? 20 : Math.min(maxPages, 20);

        for (let currentPage = 1; currentPage <= pagesToScrape; currentPage++) {
            // Check for cancellation
            if (abortSignal?.aborted) {
                console.error('Scraping cancelled by user');
                if (onProgress) onProgress('Scraping cancelled', allItems.length);
                throw new Error('Scraping cancelled');
            }

            // Construct page URL
            const pageUrl = currentPage === 1
                ? startUrl.replace(/-p\d+/, '')
                : startUrl.replace(/\/(\d+)(-p\d+)?\.htm/, `/${baseId}-p${currentPage}.htm`);

            console.error(`Scraping page ${currentPage}: ${pageUrl}`);
            if (onProgress) onProgress(`Loading page ${currentPage}...`, allItems.length);

            const page = await browser.newPage();

            try {
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait for client-side filters to apply (especially for URLs with hash parameters)
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Wait for products to load
                await page.waitForSelector('a.browsinglink', { timeout: 15000 });

                const products = await page.evaluate(() => {
                    const items = [];
                    // Find all product links - look for browsinglink elements that also have name class
                    const productLinks = document.querySelectorAll('a.browsinglink.name, a.browsinglink');

                    productLinks.forEach(linkEl => {
                        try {
                            // Only process links that have the 'name' class
                            if (!linkEl.classList.contains('name')) {
                                return;
                            }

                            const link = linkEl.href;
                            const heading = linkEl.textContent.trim();

                            // Skip if no valid heading
                            if (!heading || heading.length < 3) {
                                return;
                            }

                            // Find price - look for parent container and search for price
                            let price = 'N/A';
                            let parent = linkEl.closest('.box, .product-box, div[data-id], .cbox');

                            // Collect additional info for body
                            const bodyParts = [heading];

                            if (parent) {
                                // Try to find the detailed description line on the listing page
                                const allText = parent.textContent;
                                const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const descMatch = allText.match(new RegExp(escapedHeading + "\\s+([\\s\\S]*?)(?:\\+Darček|\\d+\\s*€|Od \\d)"));
                                if (descMatch && descMatch[1]) {
                                    const desc = descMatch[1].trim();
                                    if (desc && desc !== heading && desc.length > 10) {
                                        bodyParts.push(desc.substring(0, 500));
                                    }
                                }

                                // Look for discounted price first, then original price
                                let priceEl = parent.querySelector('.coupon-block__price');
                                if (priceEl) {
                                    // Discounted price exists, use it
                                    price = priceEl.textContent.trim().replace(/\s/g, ' ');
                                } else {
                                    // No discount, use primary price
                                    priceEl = parent.querySelector('.price-box__primary-price');
                                    if (priceEl) {
                                        price = priceEl.textContent.trim().replace(/\s/g, ' ');
                                    } else {
                                        // Fallback: search for € symbol in text
                                        const priceMatch = allText.match(/(\d+(?:\s*\d+)*(?:[.,]\d{2})?\s*€)/);
                                        if (priceMatch) {
                                            price = priceMatch[1].trim();
                                        }
                                    }
                                }

                                // Look for specs/parameters visible on listing
                                const specs = parent.querySelectorAll('.spec, .parameter, [class*="spec"]');
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


                            if (heading && link) {
                                items.push({
                                    heading,
                                    price: price || 'N/A',
                                    link,
                                    body: bodyParts.length > 1 ? bodyParts.join(' | ') : heading
                                });
                            }
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

                // Add products directly without fetching details (much faster)
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

module.exports = { scrapeAlza };
