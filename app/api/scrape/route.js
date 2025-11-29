import { scrapeBazos } from '@/scraper';
import { scrapeMojadm } from '@/scraper-mojadm';

const BAZOS_DOMAINS = ['bazos.sk', 'pc.bazos.sk', 'www.bazos.sk', 'auto.bazos.sk', 'dom.bazos.sk', 'elektro.bazos.sk', 'hudba.bazos.sk', 'knihy.bazos.sk', 'mobily.bazos.sk', 'motocykle.bazos.sk', 'nabytok.bazos.sk', 'oblecenie.bazos.sk', 'sluzby.bazos.sk', 'sport.bazos.sk', 'stroje.bazos.sk', 'vstupenky.bazos.sk', 'zvierata.bazos.sk', 'deti.bazos.sk', 'ostatne.bazos.sk'];
const MOJADM_DOMAINS = ['mojadm.sk', 'www.mojadm.sk'];
const ALLOWED_DOMAINS = [...BAZOS_DOMAINS, ...MOJADM_DOMAINS];
const MAX_PAGES = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const pages = searchParams.get('pages');
  const stream = searchParams.get('stream') === 'true';

  if (!url) {
    return new Response(JSON.stringify({ error: 'URL is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const parsedUrl = new URL(url);
    if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
      return new Response(JSON.stringify({ error: 'Invalid domain. Only bazos.sk and mojadm.sk are supported.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const pagesToScrape = pages ? Math.min(parseInt(pages), MAX_PAGES) : Infinity;

    // If streaming is requested, use Server-Sent Events
    if (stream) {
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          const sendEvent = (data) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            // Progress callback for scrapers
            const onProgress = (message, count) => {
              sendEvent({ type: 'progress', message, count });
            };

            let results;
            if (BAZOS_DOMAINS.includes(parsedUrl.hostname)) {
              results = await scrapeBazos(url, pagesToScrape, onProgress);
            } else if (MOJADM_DOMAINS.includes(parsedUrl.hostname)) {
              results = await scrapeMojadm(url, pagesToScrape, onProgress);
            }

            sendEvent({ type: 'complete', results });
          } catch (error) {
            console.error('Scraping error:', error);
            sendEvent({ type: 'error', message: 'Scraping failed' });
          } finally {
            controller.close();
          }
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

    // Non-streaming mode (backward compatible)
    let results;
    if (BAZOS_DOMAINS.includes(parsedUrl.hostname)) {
      results = await scrapeBazos(url, pagesToScrape);
    } else if (MOJADM_DOMAINS.includes(parsedUrl.hostname)) {
      results = await scrapeMojadm(url, pagesToScrape);
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported domain' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Scraping error:', error);
    return new Response(JSON.stringify({ error: 'Scraping failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
