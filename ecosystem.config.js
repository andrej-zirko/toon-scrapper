module.exports = {
    apps: [
        {
            name: 'toon-scrapper',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            env: {
                CHROME_PATH: '/snap/bin/chromium',
                PORT: 3000,
                NODE_ENV: 'production'
            }
        }
    ]
};
