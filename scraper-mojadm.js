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
                description: [],
                dmNumber: '',
                ean: '',
                properties: [],
                ingredients: ''
            };

            // Find all text content
            const bodyText = document.body.textContent;

            // Extract description bullets - look for bullet points after "Popis produktu"
            const descMatch = bodyText.match(/Popis produktu([\s\S]*?)(?:dm-číslo produktu|Vlastnosti|$)/);
            if (descMatch) {
                const descText = descMatch[1];
                // Split by common bullet indicators or new lines
                const bullets = descText.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 5 && !line.includes('Creme') && !line.startsWith('NIVEA'));
                result.description = bullets.slice(0, 10); // Take up to 10 description points
            }

            // Extract dm number
            const dmMatch = bodyText.match(/dm-číslo produktu:\s*(\d+)/);
            if (dmMatch) result.dmNumber = dmMatch[1];

            // Extract EAN
            const eanMatch = bodyText.match(/EAN:\s*(\d+)/);
            if (eanMatch) result.ean = eanMatch[1];

            // Extract properties (Vlastnosti)
            const vlastnostiMatch = bodyText.match(/Vlastnosti([\s\S]*?)(?:Zložky|$)/);
            if (vlastnostiMatch) {
                const vlastText = vlastnostiMatch[1];
                const props = vlastText.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.includes(':'))
                    .slice(0, 10);
                result.properties = props;
            }

            // Extract ingredients (Zložky)
            const zlozkyMatch = bodyText.match(/Zložky([\s\S]*?)(?:Upozornenie|Obsah|$)/);
            if (zlozkyMatch) {
                result.ingredients = zlozkyMatch[1].trim().substring(0, 500);
            }

            return result;
        });

        // Format the body with all detailed information
        const bodyParts = [];

        if (basicInfo.body) {
            bodyParts.push(basicInfo.body);
        }

        if (details.description.length > 0) {
            bodyParts.push('\nPopis: ' + details.description.join('; '));
        }

        if (details.dmNumber) {
            bodyParts.push(`dm-číslo: ${details.dmNumber}`);
        }

        if (details.ean) {
            bodyParts.push(`EAN: ${details.ean}`);
        }

        if (details.properties.length > 0) {
            bodyParts.push('Vlastnosti: ' + details.properties.join('; '));
        }

        if (details.ingredients) {
            bodyParts.push(`Zložky: ${details.ingredients}`);
        }

        return {
            ...basicInfo,
            body: bodyParts.join(' | ')
        };

    } catch (error) {
        console.error(`  Error fetching details for ${basicInfo.heading}:`, error.message);
        return basicInfo; // Return basic info if detail fetch fails
    }
}

async function scrapeMojadm(startUrl, maxPages = Infinity, onProgress = null) {
    let browser, chrome;

    try {
        ({ browser, chrome } = await launchBrowser());
        const allItems = [];

        console.error('Starting mojadm.sk scrape...');
        if (onProgress) onProgress('Starting mojadm.sk scrape...', 0);

        // Determine if we should use infinite scroll or URL pagination
        const useInfiniteScroll = maxPages === Infinity;

        if (useInfiniteScroll) {
            // Infinite scroll approach: load one page and keep scrolling
            const page = await browser.newPage();

            try {
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.goto(startUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                await page.waitForSelector('div[data-dmid="product-tile"]', { timeout: 15000 });

                let previousCount = 0;
                let buttonNotFoundCount = 0;
                let noNewProductsCount = 0;
                let clickAttempts = 0;
                const maxClickAttempts = 100; // Increase limit for pages with many products

                console.error('Using infinite scroll mode with "Načítať viac" button...');
                if (onProgress) onProgress('Loading products with infinite scroll...', 0);

                while (clickAttempts < maxClickAttempts) {
                    // Scroll to bottom first to make button visible
                    await page.evaluate(() => {
                        window.scrollTo(0, document.body.scrollHeight);
                    });
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Try to find and click the "Načítať viac" (Load more) button  
                    const buttonClicked = await page.evaluate(() => {
                        // Look for button containing "Načítať viac" or similar text
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
                        console.error(`  Clicked "Načítať viac" button (attempt ${clickAttempts + 1})`);
                        buttonNotFoundCount = 0; // Reset counter when button is found
                        // Wait longer for new products to load after clicking
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    } else {
                        buttonNotFoundCount++;
                        console.error(`  "Načítať viac" button not found (${buttonNotFoundCount}/5)`);

                        // If button hasn't been found for 5 attempts, we're probably done
                        if (buttonNotFoundCount >= 5) {
                            console.error('  Button not found after 5 attempts, assuming all products loaded.');
                            break;
                        }

                        // Continue scrolling even without button
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }

                    // Count current products
                    const currentCount = await page.evaluate(() => {
                        return document.querySelectorAll('div[data-dmid="product-tile"]').length;
                    });

                    console.error(`  Attempt ${clickAttempts + 1}: Found ${currentCount} products`);
                    if (onProgress) onProgress(`Loading products (${currentCount} found)...`, 0);

                    if (currentCount === previousCount) {
                        noNewProductsCount++;
                        // Only stop if no new products AND button not found
                        if (noNewProductsCount >= 3 && buttonNotFoundCount >= 2) {
                            console.error('  No new products and button not found, stopping.');
                            break;
                        }
                    } else {
                        noNewProductsCount = 0;
                    }

                    previousCount = currentCount;
                    clickAttempts++;
                }

                console.error(`  Finished loading. Total products found: ${previousCount}`);

                // Extract all products after scrolling
                const products = await page.evaluate(() => {
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
                                items.push({
                                    heading,
                                    price,
                                    link,
                                    body: body || heading
                                });
                            }
                        } catch (err) {
                            console.error('Error extracting product:', err);
                        }
                    });

                    return items;
                });

                console.error(`Found ${products.length} total products via infinite scroll`);
                if (onProgress) onProgress(`Found ${products.length} products, fetching details...`, allItems.length);

                // Fetch details for each product in batches of 3
                for (let i = 0; i < products.length; i += 3) {
                    const batch = products.slice(i, i + 3);
                    const detailedProducts = [];

                    for (const product of batch) {
                        const detailed = await scrapeProductDetails(page, product.link, product);
                        detailedProducts.push(detailed);
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }

                    allItems.push(...detailedProducts);
                    console.error(`  Processed ${Math.min(i + 3, products.length)}/${products.length} products`);
                    if (onProgress) onProgress(`Processing product details (${allItems.length}/${products.length})...`, allItems.length);
                }

            } catch (error) {
                console.error(`Error during infinite scroll:`, error.message);
            } finally {
                await page.close();
            }

        } else {
            // URL-based pagination approach: use currentPage parameter
            for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
                const pageUrl = startUrl.replace(/currentPage=\d+/, `currentPage=${currentPage}`);
                console.error(`Scraping page ${currentPage}: ${pageUrl}`);

                const page = await browser.newPage();

                try {
                    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                    await page.waitForSelector('div[data-dmid="product-tile"]', { timeout: 15000 });

                    const products = await page.evaluate(() => {
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
                                    items.push({
                                        heading,
                                        price,
                                        link,
                                        body: body || heading
                                    });
                                }
                            } catch (err) {
                                console.error('Error extracting product:', err);
                            }
                        });

                        return items;
                    });

                    console.error(`Found ${products.length} products on page ${currentPage}`);

                    // Fetch details for each product in batches of 3
                    for (let i = 0; i < products.length; i += 3) {
                        const batch = products.slice(i, i + 3);
                        const detailedProducts = [];

                        for (const product of batch) {
                            const detailed = await scrapeProductDetails(page, product.link, product);
                            detailedProducts.push(detailed);
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }

                        allItems.push(...detailedProducts);
                        console.error(`  Processed ${Math.min(i + 3, products.length)}/${products.length} products`);
                    }

                } catch (error) {
                    console.error(`Error on page ${currentPage}:`, error.message);
                } finally {
                    await page.close();
                }

                // Check if we have products, if not break
                if (allItems.length === 0 && currentPage === 1) {
                    console.error('No products found on first page.');
                    break;
                }

                // Small delay between pages
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
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

module.exports = { scrapeMojadm };
