const puppeteer = require('puppeteer-core');
const chromeLauncher = require('chrome-launcher');

const DEFAULT_MAC_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function launchBrowser() {
    const chromePath = process.env.CHROME_PATH || DEFAULT_MAC_PATH;

    const chrome = await chromeLauncher.launch({
        chromePath,
        chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
    });

    const response = await fetch(`http://localhost:${chrome.port}/json/version`);
    const { webSocketDebuggerUrl } = await response.json();

    const browser = await puppeteer.connect({
        browserWSEndpoint: webSocketDebuggerUrl
    });

    return { browser, chrome };
}

async function closeBrowser(browser, chrome) {
    if (browser) {
        await browser.disconnect();
    }
    if (chrome) {
        await chrome.kill();
    }
}

function cleanText(text) {
    return text ? text.replace(/\s+/g, ' ').trim() : '';
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

module.exports = { launchBrowser, closeBrowser, cleanText, DEFAULT_USER_AGENT };
