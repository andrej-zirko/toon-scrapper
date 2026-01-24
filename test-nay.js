const { scrapeNay } = require('./scraper-nay');

const testUrl = 'https://www.nay.sk/televizory-podla-uhlopriecky/filter/o:10';

console.log('Testing NAY.sk scraper...');
console.log('URL:', testUrl);
console.log('\nStarting scrape (limiting to 2 pages)...\n');

scrapeNay(testUrl, 2)
    .then(results => {
        console.log('\n=== SCRAPING COMPLETE ===');
        console.log(`Total items found: ${results.length}`);
        console.log('\nFirst 3 items:');
        results.slice(0, 3).forEach((item, i) => {
            console.log(`\n${i + 1}. ${item.heading}`);
            console.log(`   Price: ${item.price}`);
            console.log(`   Link: ${item.link}`);
            console.log(`   Body: ${item.body.substring(0, 100)}...`);
        });
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
