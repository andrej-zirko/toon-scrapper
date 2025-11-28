import { NextResponse } from 'next/server';
import { scrapeBazos } from '@/scraper'; // We will configure alias or just use relative path

const ALLOWED_DOMAINS = ['bazos.sk', 'pc.bazos.sk', 'www.bazos.sk', 'auto.bazos.sk', 'dom.bazos.sk', 'elektro.bazos.sk', 'hudba.bazos.sk', 'knihy.bazos.sk', 'mobily.bazos.sk', 'motocykle.bazos.sk', 'nabytok.bazos.sk', 'oblecenie.bazos.sk', 'sluzby.bazos.sk', 'sport.bazos.sk', 'stroje.bazos.sk', 'vstupenky.bazos.sk', 'zvierata.bazos.sk', 'deti.bazos.sk', 'ostatne.bazos.sk'];
const MAX_PAGES = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const pages = searchParams.get('pages');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(url);
    if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
      return NextResponse.json({ error: 'Invalid domain. Only bazos.sk subdomains are allowed.' }, { status: 400 });
    }

    const pagesToScrape = pages ? Math.min(parseInt(pages), MAX_PAGES) : 1;

    const results = await scrapeBazos(url, pagesToScrape);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Scraping error:', error); // Log full error on server
    return NextResponse.json({ error: 'Scraping failed' }, { status: 500 }); // Generic error to client
  }
}
