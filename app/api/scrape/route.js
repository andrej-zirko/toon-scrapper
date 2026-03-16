import { scrapeBazos } from '@/scraper';
import { scrapeMojadm } from '@/scraper-mojadm';
import { scrapeAlza } from '@/scraper-alza';
import { scrapeNay } from '@/scraper-nay';
import { scrapeDecathlon } from '@/scraper-decathlon';
import {
  BAZOS_DOMAINS, MOJADM_DOMAINS, ALZA_DOMAINS, NAY_DOMAINS, DECATHLON_DOMAINS,
  isDomainAllowed, parsePages,
} from '@/lib/validation';

function getScraperForDomain(hostname) {
  if (BAZOS_DOMAINS.includes(hostname)) return scrapeBazos;
  if (MOJADM_DOMAINS.includes(hostname)) return scrapeMojadm;
  if (ALZA_DOMAINS.includes(hostname)) return scrapeAlza;
  if (NAY_DOMAINS.includes(hostname)) return scrapeNay;
  if (DECATHLON_DOMAINS.includes(hostname)) return scrapeDecathlon;
  return null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const pages = searchParams.get('pages');
  const stream = searchParams.get('stream') === 'true';

  if (!url) {
    return jsonResponse({ error: 'URL is required' }, 400);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return jsonResponse({ error: 'Invalid URL format' }, 400);
  }

  if (!isDomainAllowed(parsedUrl.hostname)) {
    return jsonResponse({ error: 'Invalid domain. Only bazos.sk, mojadm.sk, alza.sk, nay.sk, and decathlon.sk are supported.' }, 400);
  }

  const scraper = getScraperForDomain(parsedUrl.hostname);
  if (!scraper) {
    return jsonResponse({ error: 'Unsupported domain' }, 400);
  }

  const pagesToScrape = parsePages(pages);

  if (stream) {
    const encoder = new TextEncoder();
    const abortController = new AbortController();

    const customReadable = new ReadableStream({
      async start(controller) {
        const sendEvent = (data) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const onProgress = (message, count) => {
            sendEvent({ type: 'progress', message, count });
          };

          const results = await scraper(url, pagesToScrape, onProgress, abortController.signal);
          sendEvent({ type: 'complete', results });
        } catch (error) {
          if (error.message === 'Scraping cancelled') {
            sendEvent({ type: 'cancelled', message: 'Scraping was cancelled' });
          } else {
            console.error('Scraping error:', error);
            sendEvent({ type: 'error', message: 'Scraping failed' });
          }
        } finally {
          controller.close();
        }
      },
      cancel() {
        abortController.abort();
      }
    });

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  try {
    const results = await scraper(url, pagesToScrape);
    return jsonResponse({ results });
  } catch (error) {
    console.error('Scraping error:', error);
    return jsonResponse({ error: 'Scraping failed' }, 500);
  }
}
