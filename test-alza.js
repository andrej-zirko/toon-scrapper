const { scrapeAlza } = require('./scraper-alza');

async function test() {
    console.log('Testing alza.sk scraper...\n');

    try {
        const results = await scrapeAlza(
            'https://www.alza.sk/omega-mastne-kyseliny/18862693.htm#f&availabilityFilterValue=1&cud=0&pg=1&prod=&sc=54',
            5,
            (msg, count) => {
                console.log(`Progress: ${msg} (${count} items)`);
            }
        );

        console.log('\n=== RESULTS ===');
        console.log(`Total items found: ${results.length}`);

        if (results.length > 0) {
            console.log('\nFirst 3 items:');
            results.slice(0, 3).forEach((item, i) => {
                console.log(`\n${i + 1}. ${item.heading}`);
                console.log(`   Price: ${item.price}`);
                console.log(`   Link: ${item.link}`);
            });
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
