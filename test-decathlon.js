const { scrapeDecathlon } = require('./scraper-decathlon');

const testUrl = 'https://www.decathlon.sk/8418-bandaze-a-tejpy';
const maxPages = 2;

console.log(`Testing Decathlon scraper with URL: ${testUrl}`);
console.log(`Max pages: ${maxPages}\n`);

scrapeDecathlon(testUrl, maxPages, (message, count) => {
    console.log(`[Progress] ${message} (${count} items)`);
})
    .then(results => {
        console.log(`\nScraping complete!`);
        console.log(`Total items found: ${results.length}\n`);

        if (results.length > 0) {
            console.log('First 3 items:');
            results.slice(0, 3).forEach((item, index) => {
                console.log(`\n${index + 1}. ${item.heading}`);
                console.log(`   Price: ${item.price}`);
                console.log(`   Link: ${item.link}`);
                console.log(`   Body: ${item.body.substring(0, 100)}...`);
            });
        }
    })
    .catch(error => {
        console.error('Error during scraping:', error);
        process.exit(1);
    });
