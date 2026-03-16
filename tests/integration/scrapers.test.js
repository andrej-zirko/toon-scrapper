import { describe, it, expect } from 'vitest';
import { scrapeAlza } from '../../scraper-alza.js';
import { scrapeNay } from '../../scraper-nay.js';
import { scrapeDecathlon } from '../../scraper-decathlon.js';
import { scrapeBazos } from '../../scraper.js';
import { scrapeMojadm } from '../../scraper-mojadm.js';

/**
 * Integration tests that launch real Chrome instances and scrape live sites.
 *
 * Run with: npm run test:integration
 *
 * These are slow (30-60s each) and hit real websites.
 * Use them for debugging scraper issues, not in CI.
 *
 * To run a single scraper's tests:
 *   npm run test:integration -- -t "Alza"
 */

function expectValidProduct(product) {
  expect(product).toHaveProperty('heading');
  expect(product).toHaveProperty('price');
  expect(product).toHaveProperty('link');
  expect(product).toHaveProperty('body');
  expect(product.heading.length).toBeGreaterThan(0);
  expect(product.link).toMatch(/^https?:\/\//);
}

describe('Alza scraper', () => {
  it('scrapes products from a category page', async () => {
    const progressMessages = [];
    const results = await scrapeAlza(
      'https://www.alza.sk/notebooky/18842920.htm',
      1,
      (msg, count) => progressMessages.push({ msg, count }),
    );

    expect(results.length).toBeGreaterThan(0);
    results.forEach(expectValidProduct);
    expect(progressMessages.length).toBeGreaterThan(0);
  });

  it('respects page limit', async () => {
    const results = await scrapeAlza(
      'https://www.alza.sk/notebooky/18842920.htm',
      1,
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThan(200);
  });

  it('supports cancellation', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2000);

    await expect(
      scrapeAlza(
        'https://www.alza.sk/notebooky/18842920.htm',
        10,
        null,
        controller.signal,
      )
    ).rejects.toThrow('Scraping cancelled');
  });
});

describe('NAY scraper', () => {
  it('scrapes products from a category page', async () => {
    const results = await scrapeNay(
      'https://www.nay.sk/notebooky',
      1,
    );

    expect(results.length).toBeGreaterThan(0);
    results.forEach(expectValidProduct);
  });
});

describe('Decathlon scraper', () => {
  it('scrapes products from a category page', async () => {
    const results = await scrapeDecathlon(
      'https://www.decathlon.sk/3551-horske-bicykle',
      1,
    );

    expect(results.length).toBeGreaterThan(0);
    results.forEach(expectValidProduct);
  });
});

describe('Bazos scraper', () => {
  it('scrapes products from a search page', async () => {
    const results = await scrapeBazos(
      'https://www.bazos.sk/search.php?hledat=iphone&rubriky=www&hlokalita=&humkreis=25&cenaod=&cenado=&Submit=H%C4%BEada%C5%A5&order=&kitx=ano',
      1,
    );

    expect(results.length).toBeGreaterThan(0);
    results.forEach(product => {
      expect(product).toHaveProperty('heading');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('link');
      expect(product).toHaveProperty('body');
    });
  });
});

describe('Mojadm scraper', { timeout: 180_000 }, () => {
  it('scrapes products with pagination', async () => {
    const results = await scrapeMojadm(
      'https://www.mojadm.sk/znacky/nivea?currentPage=1',
      1,
    );

    expect(results.length).toBeGreaterThan(0);
    results.forEach(expectValidProduct);
  });
});
