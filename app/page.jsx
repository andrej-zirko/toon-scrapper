'use client';

import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('https://www.bazos.sk/search.php?hledat=dell+optiplex&rubriky=www&hlokalita=&humkreis=25&cenaod=&cenado=&Submit=H%C4%BEada%C5%A5&order=&kitx=ano');
  const [pages, setPages] = useState('1'); // Default 1, but string to allow empty
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleScrape = async () => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      // Only append pages parameter if it has a value
      const pageParam = pages ? `&pages=${pages}` : '';
      const response = await fetch(`/api/scrape?url=${encodeURIComponent(url)}${pageParam}`);

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const header = '| heading | body | price | link |';
    const rows = results.map(item => {
      const clean = (str) => str ? str.replace(/\|/g, '/').replace(/"/g, '\\"') : '';
      return `| "${clean(item.heading)}" | "${clean(item.body)}" | "${clean(item.price)}" | "${item.link}" |`;
    }).join('\n');

    const text = `${header}\n${rows}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            <span className="text-orange-500">Bazoš</span> Scraper
          </h1>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">

        {/* Control Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 transition-all hover:shadow-md">
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
            <div className="flex-grow w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste Bazos URL here..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
              />
            </div>

            <div className="w-full md:w-32">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pages</label>
              <input
                type="number"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                placeholder="All"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                min="1"
              />
            </div>

            <button
              onClick={handleScrape}
              disabled={loading}
              className={`w-full md:w-auto px-8 py-3 rounded-lg font-medium text-white shadow-sm transition-all transform active:scale-95
                ${loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700 hover:shadow-md'
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : 'Scrape Now'}
            </button>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Results Area */}
        {results.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-800">Results Found</h3>
                <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">
                  {results.length} Items
                </span>
              </div>

              <button
                onClick={handleCopy}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${copied
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {copied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy TOON
                  </>
                )}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                    <th className="px-6 py-4 font-medium">Product</th>
                    <th className="px-6 py-4 font-medium w-1/2">Description</th>
                    <th className="px-6 py-4 font-medium whitespace-nowrap">Price</th>
                    <th className="px-6 py-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((item, index) => (
                    <tr key={index} className="hover:bg-orange-50 transition-colors group">
                      <td className="px-6 py-4 align-top">
                        <div className="font-semibold text-gray-900 group-hover:text-orange-700 transition-colors">
                          {item.heading}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm leading-relaxed align-top">
                        {item.body.length > 150 ? `${item.body.substring(0, 150)}...` : item.body}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-green-600 text-lg align-top">
                        {item.price}
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-800 hover:underline"
                        >
                          View Item
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          !loading && (
            <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-lg">Ready to scrape. Enter a URL above.</p>
            </div>
          )
        )}
      </main>
    </div>
  );
}
