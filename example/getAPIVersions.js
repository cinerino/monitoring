const request = require('request-promise-native');
const util = require('util');

const projects = require('../input/projects.json');

async function main() {
    const results = await Promise.all(projects.map(async (project) => {
        return request.get({
            url: `${project.api}/health`,
            simple: false,
            resolveWithFullResponse: true
        }).then((response) => {
            return {
                ...project,
                health: `${response.statusCode} ${response.body}`,
                version: response.headers['x-api-version']
            };
        })
            .catch((err) => {
                return {
                    ...project,
                    health: err.message,
                    version: '?'
                };
            });
    }));

    const header = util.format(
        '| %s | %s | %s | %s | %s |\n| %s | %s | %s | %s | %s |',
        `Project                                    `.slice(0, 30),
        `Version                              `.slice(0, 24),
        `Status                              `.slice(0, 24),
        `                              `.slice(0, 24),
        `                              `.slice(0, 24),
        `------------------------                                    `.slice(0, 30),
        `------------------------                              `.slice(0, 24),
        `------------------------                              `.slice(0, 24),
        `------------------------                              `.slice(0, 24),
        `------------------------                              `.slice(0, 24)
    );

    const text = util.format(
        '%s\n%s',
        header,
        results.map((result) => {
            return util.format(
                '| %s | %s | %s | %s | %s |',
                `${result.id}                                    `.slice(0, 30),
                `${result.version}                              `.slice(0, 24),
                `${result.health}                              `.slice(0, 24),
                `                              `.slice(0, 24),
                `                              `.slice(0, 24)
            );
        }).join('\n')
    );
    console.log(text);

    // backlogへ通知
    const users = await request.get(
        {
            url: `https://m-p.backlog.jp/api/v2/projects/CINERINO/users?apiKey=${process.env.BACKLOG_API_KEY}`,
            json: true
        }
    )
        .then((body) => body);

    console.log('notifying', users.length, 'people on backlog...');
    await request.post(
        {
            url: `https://m-p.backlog.jp/api/v2/issues/CINERINO-66/comments?apiKey=${process.env.BACKLOG_API_KEY}`,
            form: {
                content: text,
                notifiedUserId: users.map((user) => user.id)
            }
        }
    )
        .promise();

    console.log('posted to backlog.');
}

main().then().catch(console.error);
